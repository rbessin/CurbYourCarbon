/**
 * Carbon calculation utilities for extension events.
 */
import { CARBON_ESTIMATES, EQUIVALENCIES } from "./constants.js";

/**
 * Calculate video impact in grams CO2.
 * @param {number} durationMinutes
 * @param {string} resolution
 * @returns {number}
 */
export const calculateVideoImpact = (durationMinutes, resolution) => {
  const perHour =
    CARBON_ESTIMATES.video[resolution] || CARBON_ESTIMATES.video["1080p"];
  const hours = Math.max(durationMinutes, 0) / 60;
  return +(perHour * hours).toFixed(2);
};

/**
 * Calculate social browsing impact in grams CO2.
 * @param {number} timeActiveMinutes
 * @param {number} mediaCount
 * @param {number} imagesLoaded
 * @param {number} videosLoaded
 * @returns {number}
 */
export const calculateSocialImpact = (
  timeActiveMinutes,
  mediaCount,
  imagesLoaded = 0,
  videosLoaded = 0
) => {
  const base = Math.max(timeActiveMinutes, 0) * CARBON_ESTIMATES.social.reddit;
  const scrollingMinutes = Math.min(
    Math.max(timeActiveMinutes, 0),
    Math.max(mediaCount, 0),
  );
  const scrolling = scrollingMinutes * CARBON_ESTIMATES.social.scrolling;
  const images = Math.max(imagesLoaded, 0) * CARBON_ESTIMATES.social.imageLoad;
  const videos = Math.max(videosLoaded, 0) * CARBON_ESTIMATES.social.videoLoad;
  return +(base + scrolling + images + videos).toFixed(2);
};

/**
 * Calculate shopping impact in grams CO2.
 * @param {number} timeActiveMinutes
 * @param {number} productsViewed
 * @param {number} productCardsLoaded
 * @param {number} imagesLoaded
 * @param {number} highResImages
 * @param {number} videosLoaded
 * @returns {number}
 */
export const calculateShoppingImpact = (
  timeActiveMinutes,
  productsViewed,
  productCardsLoaded = 0,
  imagesLoaded = 0,
  highResImages = 0,
  videosLoaded = 0
) => {
  const browsing =
    Math.max(timeActiveMinutes, 0) * CARBON_ESTIMATES.shopping.amazon;
  const products =
    Math.max(productsViewed, 0) * CARBON_ESTIMATES.shopping.productView;
  const cards =
    Math.max(productCardsLoaded, 0) * CARBON_ESTIMATES.shopping.productCard;
  const images =
    Math.max(imagesLoaded, 0) * CARBON_ESTIMATES.shopping.imageLoad;
  const highRes =
    Math.max(highResImages, 0) * CARBON_ESTIMATES.shopping.highResImage;
  const videos =
    Math.max(videosLoaded, 0) * CARBON_ESTIMATES.shopping.videoLoad;
  return +(browsing + products + cards + images + highRes + videos).toFixed(2);
};

/**
 * Aggregate event impacts by category.
 * @param {Array} events
 * @returns {{video: number, social: number, shopping: number}}
 */
export const aggregateByCategory = (events) => {
  return events.reduce(
    (totals, event) => {
      if (totals[event.type] === undefined) {
        return totals;
      }
      totals[event.type] += event.carbonGrams || 0;
      return totals;
    },
    { video: 0, social: 0, shopping: 0 },
  );
};

/**
 * Calculate everyday equivalencies from total grams CO2.
 * @param {number} totalGrams
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
