/**
 * Research-based carbon calculation constants using Performance API approach.
 * 
 * CALCULATION METHODOLOGY:
 * 1. Measure actual bytes transferred (Performance API)
 * 2. Convert bytes → GB → kWh → CO2
 * 3. Add device energy cost (placeholder for future detection)
 * 4. Apply regional carbon intensity (placeholder for API integration)
 * 
 * SOURCES:
 * - International Energy Agency (IEA, 2024)
 * - The Carbon Trust (2021-2022)
 * - Greenspector environmental impact studies (2021)
 * - Academic research on digital carbon footprints
 */

/**
 * DATA TRANSFER CARBON INTENSITY
 * 
 * Based on IEA research:
 * - Modern networks: ~0.016 kWh per GB transferred
 * - This includes: data centers, network infrastructure, transmission
 */
export const NETWORK_ENERGY = {
  kWhPerGB: 0.016,  // Energy consumed per GB of data transferred
  // Source: IEA (2024), updated from 0.05 kWh/GB (2014) due to efficiency improvements
};

/**
 * GRID CARBON INTENSITY
 * 
 * Global average electricity grid emissions.
 * This should be replaced with regional API data for precision.
 * 
 * FUTURE: Use IP geolocation + carbon intensity API
 * - ElectricityMap API: Real-time grid carbon intensity by region
 * - WattTime API: Marginal emissions data
 */
export const GRID_CARBON = {
  globalAverage: 475,  // grams CO2 per kWh (global average)
  
  // Placeholders for regional API integration
  // FUTURE: Fetch from API based on user location
  regional: {
    // Examples (grams CO2 per kWh):
    // 'US-CA': 200,    // California (renewable-heavy)
    // 'DE': 350,       // Germany
    // 'PL': 650,       // Poland (coal-heavy)
    // 'IS': 18,        // Iceland (geothermal)
  }
};

/**
 * DEVICE ENERGY CONSUMPTION
 * 
 * Average energy consumption for displaying content.
 * Based on Carbon Trust research showing device type matters MORE than resolution.
 * 
 * This is a PLACEHOLDER - actual device cannot be detected via JavaScript.
 * 
 * FUTURE OPTIONS:
 * 1. Ask user to select device type in settings
 * 2. Use User Agent + screen size heuristics
 * 3. Provide range (min/max) instead of single estimate
 */
export const DEVICE_ENERGY = {
  // Watts consumed while actively browsing (estimated average across devices)
  averageBrowsing: 20,  // Mix of phone (5W), laptop (15W), desktop (30W), TV (80W)
  
  // Placeholders for future device-specific tracking
  // FUTURE: Detect or ask user
  byDevice: {
    // 'phone': 5,      // Watts
    // 'laptop': 15,    // Watts  
    // 'desktop': 30,   // Watts
    // 'tv': 80,        // Watts
  }
};

/**
 * RESOURCE TYPE WEIGHTS
 * 
 * Some resource types require more processing power than others.
 * Video decoding is more CPU-intensive than displaying static images.
 */
export const RESOURCE_WEIGHTS = {
  image: 1.0,      // Baseline
  video: 1.5,      // Video decoding requires more CPU
  script: 0.8,     // JavaScript execution
  stylesheet: 0.5, // CSS is lightweight
  document: 1.0,   // HTML pages
  other: 0.7       // Fonts, misc
};

/**
 * WEBSITE CATEGORIES
 * Used for analytics and categorization only.
 * Carbon calculation is now based on actual data, not category.
 */
export const WEBSITE_CATEGORIES = {
  video: ['youtube.com', 'netflix.com', 'twitch.tv', 'vimeo.com', 'hulu.com'],
  social: ['reddit.com', 'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com'],
  shopping: ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com', 'aliexpress.com'],
  news: ['nytimes.com', 'cnn.com', 'bbc.com', 'theguardian.com', 'reuters.com'],
  productivity: ['gmail.com', 'docs.google.com', 'office.com', 'notion.so', 'slack.com']
};

/**
 * CARBON EQUIVALENCIES
 * Convert grams CO2 to relatable everyday activities.
 */
export const EQUIVALENCIES = {
  gramsPerMileDriven: 404,      // Average car (EPA)
  gramsPerPhoneCharge: 8.8,     // Smartphone full charge
  gramsPerTreeYear: 21000       // CO2 absorbed by one tree per year
};

/**
 * DATABASE CONFIGURATION
 */
export const DB_NAME = "CurbYourCarbonDB";

export const STORE_NAMES = {
  events: "events",
  dailySummary: "daily_summary"
};

/**
 * CALCULATION FORMULA:
 * 
 * Total CO2 = Network Transfer CO2 + Device Energy CO2
 * 
 * 1. NETWORK TRANSFER CO2:
 *    MB transferred → GB → kWh → CO2
 *    CO2 = (bytes / 1024 / 1024 / 1024) × kWhPerGB × gridCarbonIntensity
 * 
 * 2. DEVICE ENERGY CO2:
 *    Minutes active → hours → kWh → CO2  
 *    CO2 = (minutes / 60) × deviceWatts / 1000 × gridCarbonIntensity
 * 
 * 3. FUTURE ENHANCEMENTS:
 *    - Replace gridCarbonIntensity with regional API data
 *    - Replace deviceWatts with user-selected or detected device
 *    - Add resource-type weights for video decoding overhead
 * 
 * EXAMPLE:
 * Watching 10 minutes of YouTube (transferred 500MB):
 * - Network: (500/1024) × 0.016 × 475 = 3.7g CO2
 * - Device: (10/60) × 20W / 1000 × 475 = 1.6g CO2  
 * - Total: 5.3g CO2
 */
