/**
 * Goal storage operations
 * 
 * Handles reading/writing goal data to chrome.storage
 */

const GOAL_STORAGE_KEY = 'carbonGoal';
const GOAL_HISTORY_KEY = 'goalHistory';

/**
 * Get current goal from storage
 * @returns {Promise<Object|null>} Goal object or null
 */
export const getCurrentGoal = async () => {
  try {
    const result = await chrome.storage.sync.get(GOAL_STORAGE_KEY);
    return result[GOAL_STORAGE_KEY] || null;
  } catch (error) {
    return null;
  }
};

/**
 * Set weekly carbon goal
 * @param {number} amount - Goal amount in grams per week
 */
export const setGoal = async (amount) => {
  const goal = {
    amount,
    period: 'week',
    setDate: new Date().toISOString().split('T')[0]
  };
  
  await chrome.storage.sync.set({ [GOAL_STORAGE_KEY]: goal });
  return goal;
};

/**
 * Get goal history (streaks, achievements)
 * @returns {Promise<Object>} Goal history
 */
export const getGoalHistory = async () => {
  try {
    const result = await chrome.storage.sync.get(GOAL_HISTORY_KEY);
    return result[GOAL_HISTORY_KEY] || {
      lastPeriodStart: null,
      lastPeriodMet: false,
      currentStreak: 0,
      bestStreak: 0,
      totalAchieved: 0
    };
  } catch (error) {
    return {
      lastPeriodStart: null,
      lastPeriodMet: false,
      currentStreak: 0,
      bestStreak: 0,
      totalAchieved: 0
    };
  }
};

/**
 * Update goal history
 * @param {Object} history - Updated history object
 */
export const updateGoalHistory = async (history) => {
  await chrome.storage.sync.set({ [GOAL_HISTORY_KEY]: history });
};
