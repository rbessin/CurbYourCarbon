/**
 * Research-based carbon calculation constants using Performance API approach.
 * 
 * SIMPLIFIED CATEGORIZATION SYSTEM:
 * Instead of 6+ categories, we use 3 clear, user-friendly categories that make sense.
 */

/**
 * DATA TRANSFER CARBON INTENSITY
 */
export const NETWORK_ENERGY = {
  kWhPerGB: 0.016,  // Energy consumed per GB of data transferred
};

/**
 * GRID CARBON INTENSITY
 */
export const GRID_CARBON = {
  globalAverage: 475,  // grams CO2 per kWh (global average)
  regional: {}  // Placeholder for API integration
};

/**
 * DEVICE ENERGY CONSUMPTION
 */
export const DEVICE_ENERGY = {
  averageBrowsing: 20,  // Watts - average across phone/laptop/desktop/TV
  byDevice: {}  // Placeholder for future device detection
};

/**
 * SIMPLIFIED WEBSITE CATEGORIES (3 categories)
 * 
 * We map all websites to one of three user-friendly categories:
 * 1. media - Streaming & social (high data, continuous engagement)
 * 2. shopping - E-commerce and product browsing
 * 3. browsing - Everything else (news, docs, search, productivity)
 */
export const WEBSITE_CATEGORIES = {
  // Streaming & Social Media (both are high-data, continuous scrolling/watching)
  media: [
    // Video streaming
    'youtube.com', 'youtu.be', 'netflix.com', 'twitch.tv', 'vimeo.com', 'hulu.com', 
    'disneyplus.com', 'hbomax.com', 'primevideo.com', 'crunchyroll.com',
    // Social media
    'reddit.com', 'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 
    'tiktok.com', 'linkedin.com', 'pinterest.com', 'snapchat.com', 'tumblr.com'
  ],
  
  // E-commerce & Shopping
  shopping: [
    'amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com', 
    'bestbuy.com', 'aliexpress.com', 'alibaba.com', 'shopify.com', 'wayfair.com',
    'nordstrom.com', 'macys.com', 'ikea.com', 'homedepot.com', 'lowes.com'
  ],
  
  // Everything else: news, docs, email, search, blogs, productivity
  browsing: [
    // News
    'nytimes.com', 'cnn.com', 'bbc.com', 'theguardian.com', 'reuters.com', 
    'wsj.com', 'washingtonpost.com', 'forbes.com', 'bloomberg.com',
    // Productivity
    'gmail.com', 'docs.google.com', 'drive.google.com', 'office.com', 
    'notion.so', 'slack.com', 'trello.com', 'asana.com',
    // Search & Reference
    'google.com', 'bing.com', 'wikipedia.org', 'stackoverflow.com',
    'github.com', 'gitlab.com'
  ]
};

/**
 * Get user-friendly category name for display.
 */
export const CATEGORY_DISPLAY_NAMES = {
  media: "Streaming & Social",
  shopping: "Shopping",
  browsing: "General Browsing"
};

/**
 * CARBON EQUIVALENCIES
 */
export const EQUIVALENCIES = {
  gramsPerMileDriven: 404,
  gramsPerPhoneCharge: 8.8,
  gramsPerTreeYear: 21000
};

/**
 * DEVICE TYPE MULTIPLIERS
 * Based on research showing device energy consumption varies significantly:
 * - Large TVs and desktops consume 4-5x more than phones
 * - Laptops consume ~2x more than phones
 * - Tablets are similar to phones
 * 
 * Source: IEA Digital Energy Report 2020, showing:
 * - 50" TV: ~150W average
 * - Desktop: ~100W average
 * - Laptop: ~50W average
 * - Tablet/Phone: ~5-10W average
 */
export const DEVICE_MULTIPLIERS = {
  phone: 0.5,              // Mobile devices are most efficient
  tablet: 0.7,             // Tablets slightly more energy
  "laptop-touchscreen": 1.0, // Base multiplier
  laptop: 1.0,             // Laptops are our baseline
  desktop: 2.5,            // Desktops use significantly more power
  tv: 4.0,                 // Large TVs have highest consumption
  unknown: 1.0             // Default to laptop baseline
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
 * Total CO2 = Network Transfer CO2 + Device Energy CO2 + Video Processing Overhead
 * 
 * 1. NETWORK TRANSFER CO2:
 *    CO2 = (bytes / 1,073,741,824) × 0.016 kWh/GB × 475 gCO2/kWh
 * 
 * 2. DEVICE ENERGY CO2:
 *    CO2 = (minutes / 60) × 20W / 1000 × 475 gCO2/kWh
 * 
 * 3. VIDEO PROCESSING OVERHEAD:
 *    CO2 = videoBytes × 0.5 × network formula
 *    (Video decoding requires ~50% extra processing power)
 */
export const BASELINE_GRID_INTENSITY = 400;
// grams CO2 per kWh - assumed global average baseline
