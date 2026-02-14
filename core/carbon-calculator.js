/**
 * Carbon calculation utilities using Performance API data.
 *
 * This calculator uses ACTUAL measured data (bytes transferred, time active)
 * rather than platform-specific estimates.
 */
import {
  NETWORK_ENERGY,
  GRID_CARBON,
  DEVICE_ENERGY,
  EQUIVALENCIES,
} from "./constants.js";

/**
 * Calculate carbon impact from network data transfer.
 *
 * @param {number} bytes - Total bytes transferred
 * @param {number} carbonIntensity - gCO2 per kWh (optional, uses global average if not provided)
 * @returns {number} grams CO2
 */
export const calculateNetworkCarbon = (bytes, carbonIntensity = null) => {
  if (!bytes || bytes <= 0) return 0;

  // Convert bytes → GB → kWh → CO2
  const GB = bytes / 1024 / 1024 / 1024;
  const kWh = GB * NETWORK_ENERGY.kWhPerGB;
  const intensity = carbonIntensity || GRID_CARBON.globalAverage;

  return +(kWh * intensity).toFixed(2);
};

/**
 * Calculate carbon impact from device energy consumption.
 *
 * @param {number} timeActiveMinutes - Minutes of active browsing
 * @param {number} deviceWatts - Device power consumption (optional, uses average if not provided)
 * @param {number} carbonIntensity - gCO2 per kWh (optional, uses global average if not provided)
 * @returns {number} grams CO2
 */
export const calculateDeviceCarbon = (
  timeActiveMinutes,
  deviceWatts = null,
  carbonIntensity = null,
) => {
  if (!timeActiveMinutes || timeActiveMinutes <= 0) return 0;

  // Convert minutes → hours → kWh → CO2
  const hours = timeActiveMinutes / 60;
  const watts = deviceWatts || DEVICE_ENERGY.averageBrowsing;
  const kWh = (watts / 1000) * hours;
  const intensity = carbonIntensity || GRID_CARBON.globalAverage;

  return +(kWh * intensity).toFixed(2);
};

/**
 * Calculate total carbon impact for a browsing session.
 *
 * This is the MAIN calculation function that combines network and device costs.
 *
 * @param {Object} data - Event data from universal tracker
 * @param {number} data.totalMB - Total MB transferred
 * @param {number} data.timeActive - Minutes of active browsing
 * @param {number} data.imageMB - MB of images loaded
 * @param {number} data.videoMB - MB of videos loaded
 * @param {Object} options - Optional overrides
 * @param {number} options.carbonIntensity - Regional carbon intensity (future API integration)
 * @param {number} options.deviceWatts - Device-specific energy (future user setting)
 * @returns {number} grams CO2
 */
export const calculateTotalCarbon = (data, options = {}) => {
  const bytes = (data.totalMB || 0) * 1024 * 1024;
  const timeActive = data.timeActive || 0;

  // Calculate network transfer cost
  const networkCarbon = calculateNetworkCarbon(bytes, options.carbonIntensity);

  // Calculate device energy cost
  const deviceCarbon = calculateDeviceCarbon(
    timeActive,
    options.deviceWatts,
    options.carbonIntensity,
  );

  // Add processing overhead for video content (decoding is energy-intensive)
  const videoBytes = (data.videoMB || 0) * 1024 * 1024;
  const videoOverhead = calculateNetworkCarbon(
    videoBytes * 0.5,
    options.carbonIntensity,
  );

  const total = networkCarbon + deviceCarbon + videoOverhead;

  // Debug logging
  if (timeActive > 0 || bytes > 0) {
    console.log("CurbYourCarbon: Calculation breakdown:", {
      network:
        networkCarbon.toFixed(2) +
        "g (" +
        (data.totalMB || 0).toFixed(2) +
        " MB)",
      device:
        deviceCarbon.toFixed(2) +
        "g (" +
        timeActive.toFixed(2) +
        " min × " +
        (options.deviceWatts || 20) +
        "W)",
      videoOverhead: videoOverhead.toFixed(2) + "g",
      total: total.toFixed(2) + "g",
    });
  }

  return +total.toFixed(2);
};

/**
 * Aggregate event impacts by category.
 *
 * @param {Array} events - Array of event objects
 * @returns {{video: number, social: number, shopping: number, browsing: number}}
 */
export const aggregateByCategory = (events) => {
  return events.reduce(
    (totals, event) => {
      const category = event.type || "browsing";
      if (!totals[category]) {
        totals[category] = 0;
      }
      totals[category] += event.carbonGrams || 0;
      return totals;
    },
    { media: 0, shopping: 0, browsing: 0 },
  );
};

/**
 * Calculate everyday equivalencies from total grams CO2.
 *
 * @param {number} totalGrams - Total CO2 in grams
 * @returns {{milesDriven: number, phonesCharged: number, treesNeeded: number}}
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
 * Get breakdown of carbon sources.
 *
 * @param {Object} data - Event data
 * @param {Object} options - Calculation options
 * @returns {{network: number, device: number, videoOverhead: number, total: number}}
 */
export const getCarbonBreakdown = (data, options = {}) => {
  const bytes = (data.totalMB || 0) * 1024 * 1024;
  const timeActive = data.timeActive || 0;
  const videoBytes = (data.videoMB || 0) * 1024 * 1024;

  const network = calculateNetworkCarbon(bytes, options.carbonIntensity);
  const device = calculateDeviceCarbon(
    timeActive,
    options.deviceWatts,
    options.carbonIntensity,
  );
  const videoOverhead = calculateNetworkCarbon(
    videoBytes * 0.5,
    options.carbonIntensity,
  );

  return {
    network: +network.toFixed(2),
    device: +device.toFixed(2),
    videoOverhead: +videoOverhead.toFixed(2),
    total: +(network + device + videoOverhead).toFixed(2),
  };
};

/**
 * FUTURE API INTEGRATION HELPERS
 *
 * These functions provide the structure for future enhancements.
 * Currently they return defaults, but can be replaced with API calls.
 */

/**
 * Get user's location using free IP geolocation.
 * Uses ipapi.co which doesn't require an API key.
 * 
 * @returns {Promise<{lat: number, lon: number, country: string}>}
 */
const getUserLocation = async () => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) throw new Error('Location API failed');
    
    const data = await response.json();
    return {
      lat: data.latitude,
      lon: data.longitude,
      country: data.country_code
    };
  } catch (error) {
    console.warn('CurbYourCarbon: Could not get location, using global average', error);
    return null;
  }
};

/**
 * Get regional carbon intensity from ElectricityMap API.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<number>} grams CO2 per kWh
 */
export const getRegionalCarbonIntensity = async (lat = null, lon = null) => {
  try {
    // If no location provided, get it
    if (lat === null || lon === null) {
      const location = await getUserLocation();
      if (!location) return GRID_CARBON.globalAverage;
      lat = location.lat;
      lon = location.lon;
    }
    
    // Import API key
    const { API_KEYS } = await import('./config.js');
    
    if (!API_KEYS.electricityMap || API_KEYS.electricityMap === 'YOUR_ELECTRICITYMAP_API_KEY_HERE') {
      console.warn('CurbYourCarbon: ElectricityMap API key not configured, using global average');
      return GRID_CARBON.globalAverage;
    }
    
    // Call ElectricityMap API
    const response = await fetch(
      `https://api.electricitymap.org/v3/carbon-intensity/latest?lon=${lon}&lat=${lat}`,
      { headers: { 'auth-token': API_KEYS.electricityMap }}
    );
    
    if (!response.ok) {
      console.warn('CurbYourCarbon: ElectricityMap API failed, using global average');
      return GRID_CARBON.globalAverage;
    }
    
    const data = await response.json();
    const carbonIntensity = data.carbonIntensity;
    
    console.log('CurbYourCarbon: Regional carbon intensity:', carbonIntensity, 'gCO2/kWh (vs global', GRID_CARBON.globalAverage, ')');
    
    return carbonIntensity || GRID_CARBON.globalAverage;
  } catch (error) {
    console.warn('CurbYourCarbon: Error fetching regional carbon intensity', error);
    return GRID_CARBON.globalAverage;
  }
};

/**
 * Get device energy consumption from user settings or auto-detect.
 *
 * @returns {Promise<number>} Watts
 */
export const getDeviceEnergyConsumption = async () => {
  try {
    const result = await chrome.storage.sync.get([
      "deviceType",
      "detectedDevice",
    ]);
    let deviceType = result.deviceType || "auto";

    // If auto, use the detected device from content script
    if (deviceType === "auto") {
      deviceType = result.detectedDevice || "laptop"; // Fallback to laptop
    }

    const watts =
      DEVICE_ENERGY.byDevice[deviceType] || DEVICE_ENERGY.averageBrowsing;
    const isAuto = !result.deviceType || result.deviceType === "auto";
    console.log(
      "CurbYourCarbon: Using device type '",
      deviceType,
      "' (",
      isAuto ? "auto-detected" : "user-selected",
      ") with",
      watts,
      "W",
    );
    return watts;
  } catch (error) {
    // If storage fails, return average
    return DEVICE_ENERGY.averageBrowsing;
  }
};
