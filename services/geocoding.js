/**
 * Geocoding service
 *
 * Converts coordinates to human-readable location names using Nominatim API
 */

/**
 * Convert coordinates to city name
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string|null>} City name or null if failed
 */
export const reverseGeocode = async (lat, lon) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "User-Agent": "CurbYourCarbon Browser Extension" } },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const address = data.address;

    const parts = [];
    if (address.city || address.town || address.village) {
      parts.push(address.city || address.town || address.village);
    }
    if (address.state) parts.push(address.state);
    if (address.country) parts.push(address.country);

    return parts.length > 0 ? parts.join(", ") : null;
  } catch (error) {
    return null;
  }
};
