/**
 * Carbon calculation functions
 *
 * Pure functions for calculating carbon emissions from network and device data
 */
import {
  NETWORK_ENERGY,
  BASELINE_GRID_INTENSITY,
  EQUIVALENCIES,
} from "../config/energy-constants.js";
import { DEVICE_ENERGY } from "../config/devices.js";

/**
 * Calculate carbon impact from network data transfer
 * @param {number} bytes - Total bytes transferred
 * @param {number} carbonIntensity - gCO2 per kWh (optional, uses baseline if not provided)
 * @returns {number} grams CO2
 */
export const calculateNetworkCarbon = (bytes, carbonIntensity = null) => {
  if (!bytes || bytes <= 0) return 0;

  const GB = bytes / 1024 / 1024 / 1024;
  const kWh = GB * NETWORK_ENERGY.kWhPerGB;
  const intensity = carbonIntensity || BASELINE_GRID_INTENSITY;

  return +(kWh * intensity).toFixed(2);
};

/**
 * Calculate carbon impact from device energy consumption
 * @param {number} timeActiveMinutes - Minutes of active browsing
 * @param {number} deviceWatts - Device power consumption (optional, uses average if not provided)
 * @param {number} carbonIntensity - gCO2 per kWh (optional, uses baseline if not provided)
 * @returns {number} grams CO2
 */
export const calculateDeviceCarbon = (
  timeActiveMinutes,
  deviceWatts = null,
  carbonIntensity = null,
) => {
  if (!timeActiveMinutes || timeActiveMinutes <= 0) return 0;

  const hours = timeActiveMinutes / 60;
  const watts = deviceWatts || DEVICE_ENERGY.averageBrowsing;
  const kWh = (watts / 1000) * hours;
  const intensity = carbonIntensity || BASELINE_GRID_INTENSITY;

  return +(kWh * intensity).toFixed(2);
};

/**
 * Calculate total carbon impact for a browsing session
 * @param {Object} data - Event data from tracker
 * @param {Object} options - Optional overrides
 * @returns {number} grams CO2
 */
export const calculateTotalCarbon = (data, options = {}) => {
  const bytes = (data.totalMB || 0) * 1024 * 1024;
  const timeActive = data.timeActive || 0;

  const networkCarbon = calculateNetworkCarbon(bytes, options.carbonIntensity);
  const deviceCarbon = calculateDeviceCarbon(
    timeActive,
    options.deviceWatts,
    options.carbonIntensity,
  );

  return +(networkCarbon + deviceCarbon).toFixed(2);
};

/**
 * Calculate carbon rate (grams per hour)
 * @param {Object} data - Event data
 * @param {Object} options - Calculation options
 * @returns {number} grams CO2 per hour
 */
export const calculateCarbonRate = (data, options = {}) => {
  const totalCarbon = calculateTotalCarbon(data, options);
  const timeActive = data.timeActive || 0;
  if (timeActive <= 0) return 0;
  return +(totalCarbon / (timeActive / 60)).toFixed(2);
};

/**
 * Aggregate events by category
 * @param {Array} events - Array of event objects
 * @returns {Object} Total carbon by category
 */
export const aggregateByCategory = (events) => {
  return events.reduce(
    (totals, event) => {
      const category = event.type || "browsing";
      if (!totals[category]) totals[category] = 0;
      totals[category] += event.carbonGrams || 0;
      return totals;
    },
    { media: 0, shopping: 0, browsing: 0 },
  );
};

/**
 * Calculate real-world equivalencies
 * @param {number} totalGrams - Total CO2 in grams
 * @returns {Object} Equivalencies (miles, phones, trees)
 */
export const calculateEquivalencies = (totalGrams) => {
  const grams = Math.max(totalGrams, 0);
  return {
    milesDriven: +(grams / EQUIVALENCIES.gramsPerMileDriven).toFixed(2),
    phonesCharged: +(grams / EQUIVALENCIES.gramsPerPhoneCharge).toFixed(2),
    treesNeeded: +(grams / EQUIVALENCIES.gramsPerTreeYear).toFixed(4),
  };
};

/**
 * Get breakdown of carbon sources
 * @param {Object} data - Event data
 * @param {Object} options - Calculation options
 * @returns {Object} Carbon breakdown by source
 */
export const getCarbonBreakdown = (data, options = {}) => {
  const bytes = (data.totalMB || 0) * 1024 * 1024;
  const timeActive = data.timeActive || 0;

  const network = calculateNetworkCarbon(bytes, options.carbonIntensity);
  const device = calculateDeviceCarbon(
    timeActive,
    options.deviceWatts,
    options.carbonIntensity,
  );

  return {
    network: +network.toFixed(2),
    device: +device.toFixed(2),
    total: +(network + device).toFixed(2),
  };
};

/**
 * Get device energy consumption from settings
 * @returns {Promise<number>} Watts
 */
export const getDeviceEnergyConsumption = async () => {
  try {
    const result = await chrome.storage.sync.get([
      "deviceType",
      "detectedDevice",
    ]);
    let deviceType = result.deviceType || "auto";

    if (deviceType === "auto") {
      deviceType = result.detectedDevice || "laptop";
    }

    return DEVICE_ENERGY.byDevice[deviceType] || DEVICE_ENERGY.averageBrowsing;
  } catch (error) {
    return DEVICE_ENERGY.averageBrowsing;
  }
};
