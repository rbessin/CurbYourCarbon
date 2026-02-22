/**
 * Achievement storage
 *
 * Persists which achievements have been unlocked and when.
 * Uses chrome.storage.sync so data follows the user across devices.
 *
 * Stored shape:
 *   achievementsUnlocked: {
 *     [achievementId]: { unlockedAt: ISO date string }
 *   }
 */

const ACHIEVEMENTS_KEY = 'achievementsUnlocked';

/**
 * Get the full unlocked achievements map.
 * @returns {Promise<Object>} Map of id → { unlockedAt }
 */
export const getUnlockedAchievements = async () => {
  try {
    const result = await chrome.storage.sync.get(ACHIEVEMENTS_KEY);
    return result[ACHIEVEMENTS_KEY] || {};
  } catch {
    return {};
  }
};

/**
 * Save any newly earned achievement IDs (skips already-unlocked ones).
 * @param {string[]} earnedIds - All currently earned achievement IDs
 * @returns {Promise<string[]>} Newly unlocked IDs (useful for notifications)
 */
export const saveNewlyUnlocked = async (earnedIds) => {
  const existing = await getUnlockedAchievements();
  const now = new Date().toISOString().split('T')[0];

  const newlyUnlocked = earnedIds.filter(id => !existing[id]);

  if (newlyUnlocked.length === 0) return [];

  const updated = { ...existing };
  newlyUnlocked.forEach(id => {
    updated[id] = { unlockedAt: now };
  });

  await chrome.storage.sync.set({ [ACHIEVEMENTS_KEY]: updated });
  return newlyUnlocked;
};
