/**
 * Research-based carbon estimates and conversion factors for digital activities.
 * 
 * SOURCES & METHODOLOGY:
 * All estimates are based on peer-reviewed research and industry reports from:
 * - International Energy Agency (IEA, 2020-2024)
 * - The Carbon Trust (2021-2022)
 * - Greenspector environmental impact studies (2021)
 * - Academic research on digital carbon footprints
 * 
 * See README.md for detailed research citations and methodology.
 */

/**
 * VIDEO STREAMING (YouTube)
 * Based on IEA/Carbon Trust research showing ~36-55g CO2e per hour of streaming.
 * 
 * Key insight: Resolution has LESS impact than commonly thought.
 * Device type (TV vs laptop vs phone) has MORE impact than resolution.
 * 
 * These estimates represent:
 * - Data transmission over networks
 * - Data center energy use
 * - End-user device energy consumption
 * - Global average electricity grid carbon intensity
 * 
 * Formula: Base streaming cost + resolution multiplier
 * - Base cost covers network/data center infrastructure
 * - Resolution multiplier accounts for additional data transfer
 */
export const CARBON_ESTIMATES = {
  video: {
    // Grams CO2e per hour of streaming
    // Based on data: 4K uses ~7GB/hr, 1080p uses ~3GB/hr, 480p uses ~0.6GB/hr
    "2160p": 55,   // 4K - highest quality, ~7GB data/hour
    "1440p": 50,   // 2K - ~4GB data/hour
    "1080p": 45,   // Full HD - ~3GB data/hour (most common)
    "720p": 40,    // HD - ~1.5GB data/hour
    "480p": 36,    // SD - ~0.6GB data/hour
    "360p": 33     // Low - ~0.3GB data/hour
  },

  /**
   * SOCIAL MEDIA (Reddit, Instagram, etc.)
   * Based on Greenspector 2021 study measuring actual app energy consumption.
   * 
   * Reddit: 2.48g CO2e per minute = 148.8g per hour
   * Values converted to "per minute of active browsing" for consistency.
   * 
   * Additional factors:
   * - Image loading adds data transfer
   * - Video content significantly increases footprint
   * - Infinite scroll preloads content
   */
  social: {
    reddit: 2.48,        // Grams per minute of active browsing
    scrolling: 0,        // Included in base rate (removed to avoid double-counting)
    imageLoad: 0.05,     // Per image loaded (thumbnail/standard)
    videoLoad: 0.15      // Per video loaded (embedded content)
  },

  /**
   * E-COMMERCE (Amazon, online shopping)
   * Based on research showing ~0.5g CO2 per website page view.
   * 
   * Key findings:
   * - Average visitor views 7.8 pages before purchasing
   * - Product images are data-intensive
   * - High-res images (product zoom) use 2x bandwidth
   * 
   * Note: This covers ONLY digital browsing, not shipping emissions.
   */
  shopping: {
    amazon: 1.0,           // Grams per minute of active browsing
    productView: 0.5,      // Per product detail page visited
    productCard: 0.15,     // Per product thumbnail loaded (search results)
    imageLoad: 0.08,       // Per standard product image loaded
    highResImage: 0.20,    // Per high-resolution image (zoom, gallery)
    videoLoad: 0.40        // Per product video loaded
  },

  /**
   * GENERAL IMAGE QUALITY ESTIMATES
   * Used for cross-platform image loading calculations.
   */
  images: {
    thumbnail: 0.02,    // Small thumbnails (<100KB)
    standard: 0.08,     // Standard images (100-500KB)
    highRes: 0.20       // High-resolution images (>500KB)
  }
};

/**
 * CARBON EQUIVALENCIES
 * Convert grams CO2 to relatable everyday activities.
 * 
 * Sources:
 * - EPA greenhouse gas equivalencies calculator
 * - USDA Forest Service carbon sequestration rates
 */
export const EQUIVALENCIES = {
  gramsPerMileDriven: 404,      // Average car (EPA)
  gramsPerPhoneCharge: 8.8,     // Smartphone full charge
  gramsPerTreeYear: 21000       // CO2 absorbed by one tree per year
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
 * IndexedDB storage for events and daily summaries.
 */
export const DB_NAME = "CurbYourCarbonDB";

export const STORE_NAMES = {
  events: "events",
  dailySummary: "daily_summary"
};

/**
 * METHODOLOGY NOTES:
 * 
 * 1. CONSERVATIVE ESTIMATES:
 *    We use mid-range estimates from peer-reviewed sources.
 *    Real-world values may vary based on:
 *    - Geographic location (electricity grid carbon intensity)
 *    - Time of day (renewable energy availability)
 *    - Device efficiency
 *    - Network infrastructure
 * 
 * 2. WHAT'S INCLUDED:
 *    - Data transmission (network infrastructure)
 *    - Data center energy use
 *    - End-user device energy consumption
 *    - Average global electricity carbon intensity
 * 
 * 3. WHAT'S NOT INCLUDED:
 *    - Device manufacturing (embodied carbon)
 *    - Network infrastructure manufacturing
 *    - Physical shipping (for e-commerce)
 *    - Content production emissions
 * 
 * 4. RESOLUTION VS DEVICE:
 *    Research shows device type has MORE impact than resolution:
 *    - Streaming on 50" TV: 4.5x more energy than laptop
 *    - Streaming on laptop: 2x more energy than phone
 *    - 4K vs 1080p: Only ~1.2x difference
 *    
 *    We cannot detect device type, so our estimates are conservative
 *    averages across all device types.
 * 
 * 5. UPDATES:
 *    These values should be reviewed annually as:
 *    - Energy grids become greener
 *    - Data centers improve efficiency
 *    - Codecs improve compression
 */
