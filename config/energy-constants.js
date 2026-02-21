/**
 * Energy and carbon intensity constants
 *
 * All values are research-backed from IEA (2024), Carbon Trust (2021)
 */

/**
 * Network data transfer energy consumption
 */
export const NETWORK_ENERGY = {
  kWhPerGB: 0.016, // Energy consumed per GB of data transferred (IEA 2024)
};

/**
 * Grid carbon intensity baseline
 *
 * BASELINE_GRID_INTENSITY is used as the standard for all calculations.
 * Regional adjustments are applied as multipliers relative to this baseline.
 */
export const BASELINE_GRID_INTENSITY = 475; // grams CO2 per kWh (global average)

/**
 * Carbon equivalencies for real-world comparisons
 */
export const EQUIVALENCIES = {
  gramsPerMileDriven: 404, // grams CO2 per mile driven
  gramsPerPhoneCharge: 8.8, // grams CO2 per phone charge
  gramsPerTreeYear: 21000, // grams CO2 absorbed by one tree per year
};

/**
 * Database configuration
 */
export const DB_NAME = "CurbYourCarbonDB";

export const STORE_NAMES = {
  events: "events",
  dailySummary: "daily_summary",
};
