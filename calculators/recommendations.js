/**
 * Recommendation definitions and generation logic
 *
 * Each recommendation has a condition checked against a shared context object.
 * Add new recommendations by appending to the RECOMMENDATIONS array — no other
 * files need to change.
 */

import { BASELINE_GRID_INTENSITY } from "../config/energy-constants.js";
import { getCurrentGoal } from "../storage/goal-storage.js";

/**
 * @typedef {Object} RecommendationContext
 * @property {Array}   events          - Raw events for the current period
 * @property {Object}  categoryTotals  - Carbon totals keyed by category
 * @property {number}  total           - Total carbon for the period (grams)
 * @property {number}  totalMB         - Total data transferred (MB)
 * @property {number}  videoMB         - Video data transferred (MB)
 * @property {number}  totalTime       - Total active browsing time (minutes)
 * @property {Object}  platformTotals  - Carbon totals keyed by platform
 * @property {Array}   topPlatform     - [name, grams] of the highest-carbon platform
 * @property {number}  gridIntensity   - Current regional grid intensity (gCO₂/kWh)
 * @property {Object|null} goal        - Current goal object, or null if unset
 */

/**
 * Format grams into a human-readable string.
 * Duplicated here so this module is self-contained.
 */
const fmt = (grams) =>
  grams >= 1000 ? `${(grams / 1000).toFixed(2)} kg` : `${grams.toFixed(1)} g`;

/**
 * Each entry: { check(ctx) → bool, build(ctx) → { action, impact, description } }
 * check() is evaluated first; build() is only called when check() returns true.
 */
export const RECOMMENDATIONS = [
  // ── Media / streaming ──────────────────────────────────────────

  {
    id: 'lower_video_quality',
    check: ({ categoryTotals, total, videoMB }) =>
      categoryTotals.media > total * 0.3 && videoMB > 100,
    build: ({ categoryTotals }) => ({
      action: "Lower video quality",
      impact: `Save ~${fmt(categoryTotals.media * 0.3)} CO₂`,
      description:
        "Streaming at 720p instead of 1080p can reduce data transfer by 30–40%.",
    }),
  },

  {
    id: 'disable_autoplay',
    check: ({ categoryTotals, total }) => categoryTotals.media > total * 0.5,
    build: ({ categoryTotals }) => ({
      action: "Disable autoplay",
      impact: `Save ~${fmt(categoryTotals.media * 0.2)} CO₂`,
      description:
        "Autoplaying videos on social media and streaming sites silently consume data even when you're not watching.",
    }),
  },

  // ── Data / network ─────────────────────────────────────────────

  {
    id: 'use_ad_blocker',
    check: ({ totalMB }) => totalMB > 500,
    build: ({ total }) => ({
      action: "Use an ad blocker",
      impact: `Save ~${fmt(total * 0.2)} CO₂`,
      description:
        "Ads and trackers account for ~20% of page weight. Blocking them reduces data transfer significantly.",
    }),
  },

  // ── Shopping ───────────────────────────────────────────────────

  {
    id: 'reduce_shopping_browsing',
    check: ({ categoryTotals, total }) =>
      total > 0 && categoryTotals.shopping > total * 0.3,
    build: ({ categoryTotals, total }) => ({
      action: "Reduce image-heavy browsing",
      impact: `Save ~${fmt(categoryTotals.shopping * 0.25)} CO₂`,
      description:
        `Shopping sites load many high-res images, making up ${((categoryTotals.shopping / total) * 100).toFixed(0)}% of your footprint. Using wishlists instead of browsing repeatedly helps.`,
    }),
  },

  // ── Platform dominance ─────────────────────────────────────────

  {
    id: 'top_platform_dominance',
    check: ({ topPlatform, total }) =>
      topPlatform !== null && total > 0 && topPlatform[1] > total * 0.5,
    build: ({ topPlatform, total }) => ({
      action: `Limit time on ${topPlatform[0]}`,
      impact: `Save ~${fmt(topPlatform[1] * 0.3)} CO₂`,
      description:
        `${topPlatform[0]} accounts for ${((topPlatform[1] / total) * 100).toFixed(0)}% of your carbon this period. Even short breaks add up over a week.`,
    }),
  },

  // ── Session length ─────────────────────────────────────────────

  {
    id: 'screen_breaks',
    check: ({ totalTime }) => totalTime > 120,
    build: ({ total, totalTime }) => ({
      action: "Take regular screen breaks",
      impact: `Save ~${fmt(total * 0.15)} CO₂`,
      description:
        `You've been browsing for ${(totalTime / 60).toFixed(1)} hours. Closing idle tabs and taking breaks reduces both device energy use and carbon output.`,
    }),
  },

  // ── Grid intensity ─────────────────────────────────────────────

  {
    id: 'off_peak_usage',
    check: ({ gridIntensity }) => gridIntensity > BASELINE_GRID_INTENSITY * 1.1,
    build: ({ gridIntensity }) => ({
      action: "Shift heavy usage to off-peak hours",
      impact: "Reduce grid carbon intensity",
      description:
        `Your regional grid (${gridIntensity.toFixed(0)} gCO₂/kWh) is ${((gridIntensity / BASELINE_GRID_INTENSITY - 1) * 100).toFixed(0)}% dirtier than average. Grids are typically cleaner late at night when renewable sources dominate.`,
    }),
  },

  // ── Goal nudge ─────────────────────────────────────────────────

  {
    id: 'set_goal',
    check: ({ goal }) => goal === null,
    build: () => ({
      action: "Set a weekly carbon goal",
      impact: "Build lasting habits",
      description:
        "Users who set goals reduce their digital carbon footprint by an average of 15–20%. Use the goal tracker to get started.",
    }),
  },

  // ── Above average (fallback before the all-clear) ──────────────

  {
    id: 'above_average',
    check: ({ total }) => total > 75 * 1.2,
    build: ({ total }) => ({
      action: "Review your browsing habits",
      impact: `${((total / 75 - 1) * 100).toFixed(0)}% above average`,
      description:
        "Your usage is higher than the typical user today. Check the platform breakdown to see where most of your carbon is coming from.",
    }),
  },
];

/**
 * Build the context object from raw event data and storage, then evaluate
 * every recommendation. Returns an array of { action, impact, description }
 * objects ready for rendering, always with at least one entry.
 *
 * @param {Array}  events
 * @param {Object} categoryTotals
 * @param {number} total
 * @returns {Promise<Array>}
 */
export const generateRecommendations = async (events, categoryTotals, total) => {
  // Derive all context values once up front
  const totalMB    = events.reduce((s, e) => s + (e.data?.totalMB   || 0), 0);
  const videoMB    = events.reduce((s, e) => s + (e.data?.videoMB   || 0), 0);
  const totalTime  = events.reduce((s, e) => s + (e.data?.timeActive || 0), 0);

  const platformTotals = {};
  events.forEach(e => {
    const p = e.platform || 'unknown';
    platformTotals[p] = (platformTotals[p] || 0) + (e.carbonGrams || 0);
  });
  const sorted = Object.entries(platformTotals).sort(([, a], [, b]) => b - a);
  const topPlatform = sorted.length > 0 ? sorted[0] : null;

  let gridIntensity = BASELINE_GRID_INTENSITY;
  try {
    const cache = await chrome.storage.local.get('gridIntensityCache');
    if (cache.gridIntensityCache?.intensity) gridIntensity = cache.gridIntensityCache.intensity;
  } catch { /* use baseline */ }

  const goal = await getCurrentGoal();

  const ctx = { events, categoryTotals, total, totalMB, videoMB, totalTime,
                platformTotals, topPlatform, gridIntensity, goal };

  const results = RECOMMENDATIONS
    .filter(r => { try { return r.check(ctx); } catch { return false; } })
    .map(r => r.build(ctx));

  // Always return at least the all-clear
  if (results.length === 0) {
    results.push({
      action: "Keep up the good work!",
      impact: "Your usage is already efficient",
      description: "Continue being mindful of your digital habits.",
    });
  }

  return results;
};
