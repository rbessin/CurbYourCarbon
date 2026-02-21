/**
 * Grid zone code to friendly name mappings
 *
 * Maps ElectricityMaps zone codes to human-readable names
 */
export const GRID_ZONE_NAMES = {
  // United States
  "US-NE-ISNE": "New England ISO",
  "US-NEISO": "New England ISO",
  "US-CAL": "California",
  "US-MIDA": "Mid-Atlantic",
  "US-NY": "New York",
  "US-PJM": "PJM Interconnection",
  "US-TEX": "Texas",
  "US-NW": "Northwest",
  "US-SE": "Southeast",
  "US-CENT": "Central",
  "US-FLA": "Florida",
  "US-MIDW": "Midwest",
  "US-CAR": "Carolinas",
  "US-TEN": "Tennessee",

  // Europe
  GB: "Great Britain",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  DK: "Denmark",
  NO: "Norway",
  SE: "Sweden",
  FI: "Finland",
  PL: "Poland",
  CZ: "Czech Republic",

  // Canada
  "CA-ON": "Ontario",
  "CA-QC": "Quebec",
  "CA-AB": "Alberta",
  "CA-BC": "British Columbia",

  // Australia
  "AU-NSW": "New South Wales",
  "AU-VIC": "Victoria",
  "AU-QLD": "Queensland",
};

/**
 * Get friendly name for a grid zone code
 * @param {string} zoneCode - ElectricityMaps zone code
 * @returns {string} Friendly zone name or original code if not found
 */
export const getGridZoneName = (zoneCode) => {
  return GRID_ZONE_NAMES[zoneCode] || zoneCode;
};
