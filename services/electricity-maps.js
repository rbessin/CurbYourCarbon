/**
 * ElectricityMaps API integration service
 *
 * Handles location detection, grid intensity fetching, and caching
 */
import { BASELINE_GRID_INTENSITY } from "../config/energy-constants.js";

const GRID_INTENSITY_CACHE_KEY = "gridIntensityCache";
const ELECTRICITY_MAPS_TOKEN_KEY = "ELECTRICITY_MAPS_TOKEN";
const LAST_KNOWN_LOCATION_KEY = "lastKnownLocation";
const GRID_INTENSITY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GEOLOCATION_REQUEST_TIMEOUT_MS = 8000;
const ELECTRICITY_MAPS_LATEST_URL_BASE =
  "https://api.electricitymaps.com/v3/carbon-intensity/latest";

let gridFetchInFlight = null;

/**
 * Get ElectricityMaps API token from storage
 * @returns {Promise<string|null>} API token or null
 */
export const getElectricityMapsToken = async () => {
  const result = await chrome.storage.local.get(ELECTRICITY_MAPS_TOKEN_KEY);
  const token = result?.[ELECTRICITY_MAPS_TOKEN_KEY];
  return typeof token === "string" && token.trim() ? token.trim() : null;
};

/**
 * Get cached grid intensity data
 * @returns {Promise<Object|null>} Cached grid data or null
 */
export const getCachedGridIntensity = async () => {
  const result = await chrome.storage.local.get(GRID_INTENSITY_CACHE_KEY);
  const cache = result?.[GRID_INTENSITY_CACHE_KEY];
  if (!cache || typeof cache !== "object") return null;
  return cache;
};

/**
 * Save grid intensity to cache
 * @param {Object} cacheObj - Grid intensity cache object
 */
export const setCachedGridIntensity = async (cacheObj) => {
  await chrome.storage.local.set({ [GRID_INTENSITY_CACHE_KEY]: cacheObj });
};

/**
 * Get last known location from cache
 * @returns {Promise<Object|null>} Location {lat, lon, updatedAt} or null
 */
export const getLastKnownLocation = async () => {
  const result = await chrome.storage.local.get(LAST_KNOWN_LOCATION_KEY);
  const location = result?.[LAST_KNOWN_LOCATION_KEY];
  if (!location || typeof location !== "object") return null;

  const lat = Number(location.lat);
  const lon = Number(location.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const updatedAt =
    typeof location.updatedAt === "number" ? location.updatedAt : null;
  return { lat, lon, updatedAt };
};

/**
 * Save location to cache
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
export const setLastKnownLocation = async (lat, lon) => {
  await chrome.storage.local.set({
    [LAST_KNOWN_LOCATION_KEY]: { lat, lon, updatedAt: Date.now() },
  });
};

/**
 * Ensure offscreen document exists for geolocation
 */
export const ensureOffscreenDocument = async () => {
  try {
    if (typeof chrome.offscreen?.hasDocument === "function") {
      const exists = await chrome.offscreen.hasDocument();
      if (exists) return;
    }
  } catch {
    // ignore
  }

  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("background/offscreen.html"),
      reasons: [chrome.offscreen.Reason.GEOLOCATION],
      justification:
        "Get approximate user location to determine local grid carbon intensity for CO2 estimates.",
    });
  } catch {
    // If it already exists, Chrome can throw; safe to ignore
  }
};

/**
 * Request geolocation from offscreen document
 * @returns {Promise<Object|null>} Location {lat, lon} or null
 */
export const requestGeolocationFromOffscreen = async () => {
  await ensureOffscreenDocument();

  return await new Promise((resolve) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      chrome.runtime.onMessage.removeListener(handler);
      resolve(null);
    }, GEOLOCATION_REQUEST_TIMEOUT_MS);

    const handler = (message) => {
      if (!message || typeof message !== "object") return;

      if (message.type === "GEOLOCATION_RESULT") {
        clearTimeout(timeoutId);
        chrome.runtime.onMessage.removeListener(handler);
        if (settled) return;
        settled = true;

        const lat = Number(message.payload?.lat);
        const lon = Number(message.payload?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          resolve({ lat, lon });
        } else {
          resolve(null);
        }
        return;
      }

      if (message.type === "GEOLOCATION_ERROR") {
        clearTimeout(timeoutId);
        chrome.runtime.onMessage.removeListener(handler);
        if (settled) return;
        settled = true;
        resolve(null);
      }
    };

    chrome.runtime.onMessage.addListener(handler);

    chrome.runtime.sendMessage({ type: "GET_GEOLOCATION" }, () => {
      if (chrome.runtime.lastError) {
        // ignore
      }
    });
  });
};

/**
 * Get best available location (cached or live)
 * @returns {Promise<Object|null>} Location {lat, lon} or null
 */
export const getBestAvailableLocation = async () => {
  // Prefer recent cached location (<= 30 minutes old)
  const cached = await getLastKnownLocation();
  if (cached?.updatedAt && Date.now() - cached.updatedAt < 30 * 60 * 1000) {
    return { lat: cached.lat, lon: cached.lon };
  }

  const live = await requestGeolocationFromOffscreen();
  if (live) {
    await setLastKnownLocation(live.lat, live.lon);
    return live;
  }

  // Fall back to any cached location (even if stale)
  if (cached) return { lat: cached.lat, lon: cached.lon };

  return null;
};

/**
 * Fetch grid intensity from ElectricityMaps API
 * @param {string} token - API token
 * @param {Object} location - Location {lat, lon} or null
 * @returns {Promise<Object>} Grid intensity data
 */
export const fetchGridIntensityFromElectricityMaps = async (
  token,
  location,
) => {
  let url = ELECTRICITY_MAPS_LATEST_URL_BASE;

  if (
    location &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lon)
  ) {
    url = `${ELECTRICITY_MAPS_LATEST_URL_BASE}?lat=${encodeURIComponent(
      location.lat,
    )}&lon=${encodeURIComponent(location.lon)}`;
  } else {
    url = `${ELECTRICITY_MAPS_LATEST_URL_BASE}?zone=US`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { "auth-token": token },
  });

  if (!response.ok) {
    throw new Error(
      `Electricity Maps request failed with status ${response.status}`,
    );
  }

  const data = await response.json();
  const intensityValueCandidates = [
    data?.carbonIntensity,
    data?.carbonIntensityAvg,
    data?.intensity,
  ];
  const intensity = intensityValueCandidates.find(
    (value) => typeof value === "number" && Number.isFinite(value),
  );

  if (typeof intensity !== "number") {
    throw new Error(
      "Electricity Maps response missing numeric carbon intensity",
    );
  }

  return {
    intensity,
    zone: typeof data?.zone === "string" ? data.zone : null,
    updatedAt: Date.now(),
    isEstimated:
      typeof data?.isEstimated === "boolean" ? data.isEstimated : null,
  };
};

/**
 * Get real-time grid intensity (cached or fresh)
 * @returns {Promise<Object|null>} Grid intensity data or null
 */
export const getRealtimeGridIntensity = async () => {
  const cached = await getCachedGridIntensity();

  // Use fresh cache
  if (
    cached &&
    typeof cached.updatedAt === "number" &&
    Date.now() - cached.updatedAt < GRID_INTENSITY_TTL_MS
  ) {
    return cached;
  }

  // Reuse in-flight request
  if (gridFetchInFlight) {
    try {
      return await gridFetchInFlight;
    } catch {
      return cached || null;
    }
  }

  const token = await getElectricityMapsToken();
  if (!token) return cached || null;

  gridFetchInFlight = (async () => {
    try {
      const location = await getBestAvailableLocation();
      const fresh = await fetchGridIntensityFromElectricityMaps(
        token,
        location,
      );
      await setCachedGridIntensity(fresh);
      return fresh;
    } finally {
      gridFetchInFlight = null;
    }
  })();

  try {
    return await gridFetchInFlight;
  } catch (error) {
    return cached || null;
  }
};

/**
 * Calculate grid multiplier for regional adjustments
 * @param {number} intensity - Regional carbon intensity
 * @returns {number|null} Multiplier or null
 */
export const getGridMultiplier = (intensity) => {
  if (
    typeof intensity !== "number" ||
    !Number.isFinite(intensity) ||
    BASELINE_GRID_INTENSITY <= 0
  ) {
    return null;
  }
  return +(intensity / BASELINE_GRID_INTENSITY).toFixed(3);
};
