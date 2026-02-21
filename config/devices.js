/**
 * Device type configuration for energy consumption tracking
 */

/**
 * Device energy consumption in Watts
 */
export const DEVICE_ENERGY = {
  averageBrowsing: 20, // Average across all device types
  byDevice: {
    phone: 5,
    tablet: 10,
    laptop: 20,
    desktop: 40,
    tv: 100,
  },
};

/**
 * User-friendly device display names
 */
export const DEVICE_DISPLAY_NAMES = {
  phone: "📱 Phone (5W)",
  tablet: "📱 Tablet (10W)",
  laptop: "💻 Laptop (20W)",
  desktop: "🖥️ Desktop (40W)",
  tv: "📺 TV (100W)",
};

/**
 * Get display name for device type
 * @param {string} deviceType - Device type code
 * @param {string} detectedDevice - Auto-detected device (optional)
 * @returns {string} Display name
 */
export const getDeviceDisplayName = (deviceType, detectedDevice = "laptop") => {
  if (deviceType === "auto") {
    return `🔍 Auto (${detectedDevice} detected)`;
  }
  return DEVICE_DISPLAY_NAMES[deviceType] || DEVICE_DISPLAY_NAMES.laptop;
};
