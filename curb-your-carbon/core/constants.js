/**
 * Research-based carbon estimates and conversion factors.
 */
export const CARBON_ESTIMATES = {
  video: {
    "2160p": 440,
    "1440p": 330,
    "1080p": 220,
    "720p": 110,
    "480p": 55,
    "360p": 28
  },
  ai: {
    "gpt-4": 8.5,
    "gpt-3.5": 4.3,
    "default": 5.0
  },
  social: {
    reddit: 0.8,
    scrolling: 1.2
  },
  shopping: {
    amazon: 0.6,
    productView: 0.1
  }
};

export const EQUIVALENCIES = {
  gramsPerMileDriven: 404,
  gramsPerPhoneCharge: 8.8,
  gramsPerTreeYear: 21000
};

export const DB_NAME = "CurbYourCarbonDB";

export const STORE_NAMES = {
  events: "events",
  dailySummary: "daily_summary"
};
