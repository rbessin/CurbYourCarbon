import { StorageManager } from "../core/storage-manager.js";
import {
  calculateTotalCarbon,
  getDeviceEnergyConsumption,
} from "../core/carbon-calculator.js";
import { BASELINE_GRID_INTENSITY } from "../core/constants.js";

const storageManager = new StorageManager();
const GRID_INTENSITY_CACHE_KEY = "gridIntensityCache";
const ELECTRICITY_MAPS_TOKEN_KEY = "ELECTRICITY_MAPS_TOKEN";
const GRID_INTENSITY_TTL_MS = 10 * 60 * 1000;
const ELECTRICITY_MAPS_LATEST_URL =
  "https://api.electricitymaps.com/v3/carbon-intensity/latest?zone=US";

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
    console.log(
      "CurbYourCarbon: Fetching new grid intensity from Electricity Maps",
    );
    const fresh = await fetchGridIntensityFromElectricityMaps(token);
    await setCachedGridIntensity(fresh);
    return fresh;
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

/**
 * Calculate carbon emissions from event data.
 *
 * Uses Performance API data (actual bytes transferred) plus device
 * settings and realtime grid intensity (when available).
 */
const calculateEventCarbon = async (payload) => {
  const deviceWatts = await getDeviceEnergyConsumption();
  const gridData = await getRealtimeGridIntensity();
  const gridIntensity =
    typeof gridData?.intensity === "number" &&
    Number.isFinite(gridData.intensity)
      ? gridData.intensity
      : null;
  const gridMultiplier = getGridMultiplier(gridIntensity);

  const baselineCarbon = calculateTotalCarbon(payload, {
    carbonIntensity: BASELINE_GRID_INTENSITY,
    deviceWatts,
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
  if (message.type !== "TRACK_EVENT") {
    return;
  }

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
          // Accessing lastError prevents console errors when popup is closed
          if (chrome.runtime.lastError) {
            // Popup not open, that's fine
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

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // Set default device to auto-detect on first install
    await chrome.storage.sync.set({ deviceType: "auto" });
    console.log(
      "CurbYourCarbon: Extension installed - Universal tracking enabled",
    );
    console.log("CurbYourCarbon: Device set to auto-detect by default");
  }
  if (details.reason === "update") {
    // On update, set auto-detect if no device preference exists
    const result = await chrome.storage.sync.get("deviceType");
    if (!result.deviceType) {
      await chrome.storage.sync.set({ deviceType: "auto" });
      console.log("CurbYourCarbon: Device preference set to auto-detect");
    }
    console.log(
      "CurbYourCarbon: Extension updated to",
      chrome.runtime.getManifest().version,
    );
  }
});

console.log(
  "CurbYourCarbon: Service worker initialized with Performance API tracking",
);
