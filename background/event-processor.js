/**
 * Event processing logic
 *
 * Handles TRACK_EVENT messages from content scripts
 */
import { StorageManager } from "../storage/storage-manager.js";
import {
  calculateTotalCarbon,
  calculateCarbonRate,
  getDeviceEnergyConsumption,
} from "../calculators/carbon.js";
import {
  getRealtimeGridIntensity,
  getGridMultiplier,
} from "../services/electricity-maps.js";
import { BASELINE_GRID_INTENSITY } from "../config/energy-constants.js";

const storageManager = new StorageManager();

/**
 * Get date key for daily summaries
 * @param {number} timestamp - Event timestamp
 * @returns {string} Date key (YYYY-MM-DD)
 */
const getDateKey = (timestamp) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Update daily summary with new event
 * @param {Object} eventRecord - Event record
 */
const updateDailySummary = async (eventRecord) => {
  const dateKey = getDateKey(eventRecord.timestamp);
  const existing = (await storageManager.getDailySummary(dateKey)) || {
    date: dateKey,
    totalCarbon: 0,
    byCategory: { media: 0, shopping: 0, browsing: 0 },
    byPlatform: {},
  };

  existing.totalCarbon += eventRecord.carbonGrams;

  const category = eventRecord.type || "browsing";
  if (!existing.byCategory[category]) {
    existing.byCategory[category] = 0;
  }
  existing.byCategory[category] += eventRecord.carbonGrams;

  if (!existing.byPlatform[eventRecord.platform]) {
    existing.byPlatform[eventRecord.platform] = 0;
  }
  existing.byPlatform[eventRecord.platform] += eventRecord.carbonGrams;

  await storageManager.saveDailySummary(existing);
};

/**
 * Calculate carbon emissions with regional grid data
 * @param {Object} payload - Event data from tracker
 * @returns {Promise<Object>} Carbon calculation result with grid context
 */
export const calculateEventCarbon = async (payload) => {
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

  const baselineCarbonRate = calculateCarbonRate(payload, {
    carbonIntensity: BASELINE_GRID_INTENSITY,
    deviceWatts,
  });
  const carbonRate =
    gridMultiplier !== null
      ? +(baselineCarbonRate * gridMultiplier).toFixed(2)
      : baselineCarbonRate;

  return {
    carbonGrams,
    carbonRate,
    gridIntensity,
    gridZone: typeof gridData?.zone === "string" ? gridData.zone : null,
    gridMultiplier,
    gridIsEstimated:
      typeof gridData?.isEstimated === "boolean" ? gridData.isEstimated : null,
  };
};

/**
 * Process tracking event from content script
 * @param {Object} payload - Event data
 * @param {Object} sender - Message sender
 * @returns {Promise<Object>} Response object
 */
export const processTrackingEvent = async (payload) => {
  const gridContext = await calculateEventCarbon(payload);
  const { carbonGrams, carbonRate } = gridContext;

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
    carbonRate,
  };

  await storageManager.saveEvent(eventRecord);
  await updateDailySummary(eventRecord);

  return {
    ok: true,
    carbonGrams,
    carbonRate,
    gridIntensity: gridContext.gridIntensity,
    gridZone: gridContext.gridZone,
    gridMultiplier: gridContext.gridMultiplier,
    gridIsEstimated: gridContext.gridIsEstimated,
  };
};

// Expose storage manager for debugging
export { storageManager };
