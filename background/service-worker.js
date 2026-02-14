import { StorageManager } from "../core/storage-manager.js";
import {
  calculateShoppingImpact,
  calculateSocialImpact,
  calculateVideoImpact,
} from "../core/carbon-calculator.js";
import { BASELINE_GRID_INTENSITY } from "../core/constants.js";

const storageManager = new StorageManager();
const GRID_INTENSITY_CACHE_KEY = "gridIntensityCache";
const ELECTRICITY_MAPS_TOKEN_KEY = "ELECTRICITY_MAPS_TOKEN";
const GRID_INTENSITY_TTL_MS = 10 * 60 * 1000;
const ELECTRICITY_MAPS_LATEST_URL =
  "https://api.electricitymaps.com/v3/carbon-intensity/latest";

const getElectricityMapsToken = async () => {
  const result = await chrome.storage.local.get(ELECTRICITY_MAPS_TOKEN_KEY);
  const token = result?.[ELECTRICITY_MAPS_TOKEN_KEY];
  return typeof token === "string" && token.trim() ? token.trim() : null;
};

const getCachedGridIntensity = async () => {
  const result = await chrome.storage.local.get(GRID_INTENSITY_CACHE_KEY);
  const cache = result?.[GRID_INTENSITY_CACHE_KEY];
  if (!cache || typeof cache !== "object") {
    return null;
  }
  return cache;
};

const setCachedGridIntensity = async (cacheObj) => {
  await chrome.storage.local.set({ [GRID_INTENSITY_CACHE_KEY]: cacheObj });
};

const fetchGridIntensityFromElectricityMaps = async (token) => {
  const response = await fetch(ELECTRICITY_MAPS_LATEST_URL, {
    method: "GET",
    headers: {
      "auth-token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Electricity Maps request failed with status ${response.status}`);
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
    isEstimated:
      typeof data?.isEstimated === "boolean" ? data.isEstimated : null,
  };
};

const getRealtimeGridIntensity = async () => {
  const cached = await getCachedGridIntensity();
  if (
    cached &&
    typeof cached.updatedAt === "number" &&
    Date.now() - cached.updatedAt < GRID_INTENSITY_TTL_MS
  ) {
    console.log("CurbYourCarbon: Using cached grid intensity value");
    return cached;
  }

  const token = await getElectricityMapsToken();
  if (!token) {
    console.warn("CurbYourCarbon: Electricity Maps token missing");
    return cached || null;
  }

  try {
    console.log("CurbYourCarbon: Fetching new grid intensity from Electricity Maps");
    const fresh = await fetchGridIntensityFromElectricityMaps(token);
    await setCachedGridIntensity(fresh);
    return fresh;
  } catch (error) {
    console.warn("CurbYourCarbon: Failed to fetch grid intensity", error);
    return cached || null;
  }
};

// Expose helpers for DevTools debugging (MV3 module scope doesn't attach consts to global)
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
    byCategory: { video: 0, social: 0, shopping: 0 },
    byPlatform: {},
  };

  existing.totalCarbon += eventRecord.carbonGrams;
  if (existing.byCategory[eventRecord.type] !== undefined) {
    existing.byCategory[eventRecord.type] += eventRecord.carbonGrams;
  }
  if (!existing.byPlatform[eventRecord.platform]) {
    existing.byPlatform[eventRecord.platform] = 0;
  }
  existing.byPlatform[eventRecord.platform] += eventRecord.carbonGrams;

  await storageManager.saveDailySummary(existing);
};

const calculateEventCarbon = async (payload) => {
  if (payload.type === "video") {
    return calculateVideoImpact(
      payload.duration || 0,
      payload.resolution || "1080p",
    );
  }

  if (payload.type === "social") {
    return calculateSocialImpact(
      payload.timeActive || 0,
      payload.mediaCount || 0,
      payload.imagesLoaded || 0,
      payload.videosLoaded || 0,
    );
  }

  if (payload.type === "shopping") {
    const baselineGrams = calculateShoppingImpact(
      payload.timeActive || 0,
      payload.productsViewed || 0,
      payload.productCardsLoaded || 0,
      payload.imagesLoaded || 0,
      payload.highResImages || 0,
      payload.videosLoaded || 0,
    );

    // Apply real-time grid intensity multiplier (Option A) ONLY for shopping.
    const grid = await getRealtimeGridIntensity();
    const intensity = grid?.intensity;

    if (typeof intensity === "number" && Number.isFinite(intensity) && BASELINE_GRID_INTENSITY > 0) {
      const multiplier = intensity / BASELINE_GRID_INTENSITY;
      const adjustedGrams = baselineGrams * multiplier;

      // Attach metadata to the payload so the dashboard can show the context later.
      payload.gridIntensity = intensity;
      payload.gridZone = grid?.zone ?? null;
      payload.gridIsEstimated = grid?.isEstimated ?? null;
      payload.gridBaselineIntensity = BASELINE_GRID_INTENSITY;
      payload.gridMultiplier = multiplier;
      payload.carbonBaselineGrams = baselineGrams;

      return adjustedGrams;
    }

    // Fallback: no grid info available, return baseline.
    payload.carbonBaselineGrams = baselineGrams;
    return baselineGrams;
  }

  return 0;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "TRACK_EVENT") {
    return;
  }

  console.log("CurbYourCarbon: Received TRACK_EVENT", message.payload);

  (async () => {
    try {
      const payload = message.payload || {};
      const carbonGrams = await calculateEventCarbon(payload);
      const eventRecord = {
        timestamp: payload.timestamp || Date.now(),
        type: payload.type,
        platform: payload.platform,
        data: payload,
        carbonGrams,
      };

      await storageManager.saveEvent(eventRecord);
      await updateDailySummary(eventRecord);

      console.log("CurbYourCarbon: Event saved successfully", eventRecord);

      // Notify popup if it's open (ignore errors if nothing is listening)
      chrome.runtime.sendMessage({ type: "EVENT_SAVED", payload: eventRecord }, () => {
        // Ignore "no receiver" errors - popup might not be open
        chrome.runtime.lastError;
      });
      
      sendResponse({
        ok: true,
        carbonGrams,
        gridIntensity: payload.gridIntensity ?? null,
        gridZone: payload.gridZone ?? null,
        gridMultiplier: payload.gridMultiplier ?? null,
      });
    } catch (error) {
      console.error("CurbYourCarbon: Failed to save event", error);
      sendResponse({
        ok: false,
        error: error.message || "Failed to save event",
      });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("CurbYourCarbon: Extension installed");
  }
  if (details.reason === "update") {
    console.log("CurbYourCarbon: Extension updated");
  }
});

console.log("CurbYourCarbon: Service worker initialized");
