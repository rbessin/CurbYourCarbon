/**
 * Website categorization for carbon tracking
 *
 * Simplified 3-category system:
 * - media: Streaming & Social (high data, continuous engagement)
 * - shopping: E-commerce
 * - browsing: Everything else (news, docs, productivity)
 */

/**
 * Website domain to category mappings
 */
export const WEBSITE_CATEGORIES = {
  media: [
    // Video streaming
    "youtube.com",
    "youtu.be",
    "netflix.com",
    "twitch.tv",
    "vimeo.com",
    "hulu.com",
    "disneyplus.com",
    "hbomax.com",
    "primevideo.com",
    "crunchyroll.com",
    // Social media
    "reddit.com",
    "instagram.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "linkedin.com",
    "pinterest.com",
    "snapchat.com",
    "tumblr.com",
  ],

  shopping: [
    "amazon.com",
    "ebay.com",
    "etsy.com",
    "walmart.com",
    "target.com",
    "bestbuy.com",
    "aliexpress.com",
    "alibaba.com",
    "shopify.com",
    "wayfair.com",
    "nordstrom.com",
    "macys.com",
    "ikea.com",
    "homedepot.com",
    "lowes.com",
  ],

  // Everything else defaults to 'browsing'
};

/**
 * User-friendly category display names
 */
export const CATEGORY_DISPLAY_NAMES = {
  media: "Streaming & Social",
  shopping: "Shopping",
  browsing: "General Browsing",
};

/**
 * Get category for a website domain
 * @param {string} domain - Website domain
 * @returns {string} Category: 'media', 'shopping', or 'browsing'
 */
export const categorizeWebsite = (domain) => {
  for (const [category, domains] of Object.entries(WEBSITE_CATEGORIES)) {
    if (domains.some((d) => domain.includes(d))) {
      return category;
    }
  }
  return "browsing";
};
