import { StorageManager } from "../core/storage-manager.js";
import { calculateTotalCarbon } from "../core/carbon-calculator.js";
import { BASELINE_GRID_INTENSITY } from "../core/constants.js";

const storageManager = new StorageManager();
globalThis.storageManager = storageManager;

const GRID_INTENSITY_CACHE_KEY = "gridIntensityCache";
const ELECTRICITY_MAPS_TOKEN_KEY = "ELECTRICITY_MAPS_TOKEN";
const LAST_KNOWN_LOCATION_KEY = "lastKnownLocation";

const GRID_INTENSITY_TTL_MS = 10 * 60 * 1000;
const GEOLOCATION_REQUEST_TIMEOUT_MS = 8000;

const OFFSCREEN_DOCUMENT_PATH = "background/offscreen.html";
const OFFSCREEN_DOCUMENT_URL = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);

const ELECTRICITY_MAPS_LATEST_URL_BASE =
  "https://api.electricitymaps.com/v3/carbon-intensity/latest";

// Prevent duplicate grid fetches if multiple events arrive at once
let gridFetchInFlight = null;

const getElectricityMapsToken = async () => {
  const result = await chrome.storage.local.get(ELECTRICITY_MAPS_TOKEN_KEY);
  const token = result?.[ELECTRICITY_MAPS_TOKEN_KEY];
  return typeof token === "string" && token.trim() ? token.trim() : null;
};

const getCachedGridIntensity = async () => {
  const result = await chrome.storage.local.get(GRID_INTENSITY_CACHE_KEY);
  const cache = result?.[GRID_INTENSITY_CACHE_KEY];
  if (!cache || typeof cache !== "object") return null;
  return cache;
};

const setCachedGridIntensity = async (cacheObj) => {
  await chrome.storage.local.set({ [GRID_INTENSITY_CACHE_KEY]: cacheObj });
};

// ---------- Location helpers (MV3-safe via offscreen doc) ----------

const getLastKnownLocation = async () => {
  const result = await chrome.storage.local.get(LAST_KNOWN_LOCATION_KEY);
  const location = result?.[LAST_KNOWN_LOCATION_KEY];
  if (!location || typeof location !== "object") return null;

  const lat = Number(location.lat);
  const lon = Number(location.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const updatedAt = typeof location.updatedAt === "number" ? location.updatedAt : null;
  return { lat, lon, updatedAt };
};

const setLastKnownLocation = async (lat, lon) => {
  await chrome.storage.local.set({
    [LAST_KNOWN_LOCATION_KEY]: { lat, lon, updatedAt: Date.now() },
  });
};

const ensureOffscreenDocument = async () => {
  // Some Chrome versions support hasDocument; if present, use it.
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
      url: OFFSCREEN_DOCUMENT_URL,
      reasons: [chrome.offscreen.Reason.GEOLOCATION],
      justification:
        "Get approximate user location to determine local grid carbon intensity for CO2 estimates.",
    });
  } catch {
    // If it already exists, Chrome can throw; safe to ignore.
  }
};

const requestGeolocationFromOffscreen = async () => {
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
      // Prevent noisy console errors when no receiver is ready
      if (chrome.runtime.lastError) {
        // ignore
      }
    });
  });
};

const getBestAvailableLocation = async () => {
  // Prefer recent stored location (<= 30 minutes old)
  const cached = await getLastKnownLocation();
  if (cached?.updatedAt && Date.now() - cached.updatedAt < 30 * 60 * 1000) {
    return { lat: cached.lat, lon: cached.lon };
  }

  const live = await requestGeolocationFromOffscreen();
  if (live) {
    await setLastKnownLocation(live.lat, live.lon);
    return live;
  }

  // Fall back to any stored location (even if stale)
  if (cached) return { lat: cached.lat, lon: cached.lon };

  return null;
};

// ---------- Electricity Maps fetch ----------

const fetchGridIntensityFromElectricityMaps = async (token, location) => {
  let url = ELECTRICITY_MAPS_LATEST_URL_BASE;

  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
    url = `${ELECTRICITY_MAPS_LATEST_URL_BASE}?lat=${encodeURIComponent(
      location.lat,
    )}&lon=${encodeURIComponent(location.lon)}`;
    console.log(
      "CurbYourCarbon: Fetching grid intensity for lat/lon",
      location.lat,
      location.lon,
    );
  } else {
    url = `${ELECTRICITY_MAPS_LATEST_URL_BASE}?zone=US`;
    console.log("CurbYourCarbon: Falling back to zone=US (no location)");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "auth-token": token,
    },
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
    throw new Error("Electricity Maps response missing numeric carbon intensity");
  }

  return {
    intensity,
    zone: typeof data?.zone === "string" ? data.zone : null,
    updatedAt: Date.now(),
    isEstimated: typeof data?.isEstimated === "boolean" ? data.isEstimated : null,
  };
};

const getRealtimeGridIntensity = async () => {
  const cached = await getCachedGridIntensity();

  // Fresh cache
  if (
    cached &&
    typeof cached.updatedAt === "number" &&
    Date.now() - cached.updatedAt < GRID_INTENSITY_TTL_MS
  ) {
    console.log("CurbYourCarbon: Using cached grid intensity value");
    return cached;
  }

  // Reuse an in-flight request so multiple events don't trigger multiple fetches
  if (gridFetchInFlight) {
    console.log("CurbYourCarbon: Grid fetch in-flight reuse");
    try {
      return await gridFetchInFlight;
    } catch {
      return cached || null;
    }
  }

  const token = await getElectricityMapsToken();
  if (!token) {
    console.warn("CurbYourCarbon: Electricity Maps token missing");
    return cached || null;
  }

  gridFetchInFlight = (async () => {
    try {
      const location = await getBestAvailableLocation();
      console.log("CurbYourCarbon: Fetching new grid intensity from Electricity Maps");
      const fresh = await fetchGridIntensityFromElectricityMaps(token, location);
      await setCachedGridIntensity(fresh);
      return fresh;
    } finally {
      gridFetchInFlight = null;
    }
  })();

  try {
    return await gridFetchInFlight;
  } catch (error) {
    console.warn("CurbYourCarbon: Failed to fetch grid intensity", error);
    return cached || null;
  }
};

const getGridMultiplier = (intensity) => {
  if (
    typeof intensity !== "number" ||
    !Number.isFinite(intensity) ||
    BASELINE_GRID_INTENSITY <= 0
  ) {
    return null;
  }
  return +(intensity / BASELINE_GRID_INTENSITY).toFixed(3);
};

// Expose helpers for DevTools debugging (MV3 module scope hides consts from console)
globalThis.getRealtimeGridIntensity = getRealtimeGridIntensity;
globalThis.getCachedGridIntensity = getCachedGridIntensity;

const getDateKey = (timestamp) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const updateDailySummary = async (eventRecord) => {
  const dateKey = getDateKey(eventRecord.timestamp);
  const existing = (await storageManager.getDailySummary(dateKey)) || {
    date: dateKey,
    totalCarbon: 0,
    byCategory: { media: 0, shopping: 0, browsing: 0 },
    byPlatform: {},
  };

  existing.totalCarbon += eventRecord.carbonGrams;

  // Update category totals
  const category = eventRecord.type || "browsing";
  if (!existing.byCategory[category]) {
    existing.byCategory[category] = 0;
  }
  existing.byCategory[category] += eventRecord.carbonGrams;

  // Update platform totals
  if (!existing.byPlatform[eventRecord.platform]) {
    existing.byPlatform[eventRecord.platform] = 0;
  }
  existing.byPlatform[eventRecord.platform] += eventRecord.carbonGrams;

  await storageManager.saveDailySummary(existing);
};

const calculateEventCarbon = async (payload) => {
  const gridData = await getRealtimeGridIntensity();
  const gridIntensity =
    typeof gridData?.intensity === "number" && Number.isFinite(gridData.intensity)
      ? gridData.intensity
      : null;

  const gridMultiplier = getGridMultiplier(gridIntensity);

  const baselineCarbon = calculateTotalCarbon(payload, {
    carbonIntensity: BASELINE_GRID_INTENSITY,
  });

  const carbonGrams =
    gridMultiplier !== null
      ? +(baselineCarbon * gridMultiplier).toFixed(2)
      : baselineCarbon;

  return {
    carbonGrams,
    gridIntensity,
    gridZone: typeof gridData?.zone === "string" ? gridData.zone : null,
    gridMultiplier,
    gridIsEstimated:
      typeof gridData?.isEstimated === "boolean" ? gridData.isEstimated : null,
  };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "TRACK_EVENT") return;

  console.log(
    "CurbYourCarbon: Received TRACK_EVENT from",
    sender.tab?.url || "popup",
  );

  (async () => {
    try {
      const payload = message.payload || {};
      const gridContext = await calculateEventCarbon(payload);
      const { carbonGrams } = gridContext;

      const eventRecord = {
        timestamp: payload.timestamp || Date.now(),
        type: payload.type || "browsing",
        platform: payload.platform || "unknown",
        data: {
          ...payload,
          gridIntensity: gridContext.gridIntensity,
          gridZone: gridContext.gridZone,
          gridMultiplier: gridContext.gridMultiplier,
          gridIsEstimated: gridContext.gridIsEstimated,
        },
        carbonGrams,
      };

      await storageManager.saveEvent(eventRecord);
      await updateDailySummary(eventRecord);

      console.log(
        "CurbYourCarbon: Event saved -",
        carbonGrams,
        "g CO2 from",
        payload.platform,
      );

      // Notify popup if it's open (ignore errors if nothing is listening)
      chrome.runtime.sendMessage(
        { type: "EVENT_SAVED", payload: eventRecord },
        () => {
          if (chrome.runtime.lastError) {
            // Popup not open; OK.
          }
        },
      );

      sendResponse({
        ok: true,
        carbonGrams,
        gridIntensity: gridContext.gridIntensity,
        gridZone: gridContext.gridZone,
        gridMultiplier: gridContext.gridMultiplier,
        gridIsEstimated: gridContext.gridIsEstimated,
      });
    } catch (error) {
      console.error("CurbYourCarbon: Failed to save event", error);
      sendResponse({
        ok: false,
        error: error.message || "Failed to save event",
      });
    }
  })();

  return true; // Keep message channel open for async response
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("CurbYourCarbon: Extension installed - Universal tracking enabled");
  }
  if (details.reason === "update") {
    console.log(
      "CurbYourCarbon: Extension updated to",
      chrome.runtime.getManifest().version,
    );
  }
});

console.log("CurbYourCarbon: Service worker initialized with Performance API tracking");
