/**
 * Goal calculation and progress logic
 * 
 * Pure functions for goal calculations, progress, and streaks
 */
import { getGoalHistory, updateGoalHistory } from "../storage/goal-storage.js";

/**
 * Weekly goal presets (grams CO2 per week)
 */
export const GOAL_PRESETS = {
  ecoWarrior: 350,
  average: 525,
  moderate: 700,
};

/**
 * Get the start of the current week (Monday at midnight)
 * @returns {Date} Week start date
 */
export const getPeriodStart = () => {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

/**
 * Check if the current week has changed since the last recorded period
 * @param {Object} history - Goal history
 * @returns {boolean} True if a new week has started
 */
export const isNewPeriod = (history) => {
  if (!history.lastPeriodStart) return true;
  
  const lastPeriodDate = new Date(history.lastPeriodStart);
  const currentPeriodStart = getPeriodStart();
  
  return currentPeriodStart.getTime() > lastPeriodDate.getTime();
};

/**
 * Calculate progress toward goal
 * @param {number} currentCarbon - Carbon used in current period
 * @param {Object} goal - Goal object
 * @returns {Object} Progress data
 */
export const calculateProgress = (currentCarbon, goal) => {
  const percentage = (currentCarbon / goal.amount) * 100;
  const remaining = goal.amount - currentCarbon;
  
  let status = 'under';
  let message = '';
  
  if (percentage < 80) {
    status = 'great';
    message = `Great! You're ${(100 - percentage).toFixed(0)}% below your goal`;
  } else if (percentage < 100) {
    status = 'near';
    message = `You're at ${percentage.toFixed(0)}% of your goal`;
  } else {
    status = 'over';
    message = `You're ${(percentage - 100).toFixed(0)}% over your goal`;
  }
  
  return {
    current: currentCarbon,
    goal: goal.amount,
    percentage: Math.min(percentage, 100),
    remaining,
    status,
    message
  };
};

/**
 * Check and update weekly streaks
 * @param {number} periodCarbon - Carbon for the completed week
 * @param {Object} goal - Goal object
 * @returns {Promise<Object>} Updated history
 */
export const checkAndUpdateStreak = async (periodCarbon, goal) => {
  const history = await getGoalHistory();
  const goalMet = periodCarbon <= goal.amount;
  
  if (goalMet) {
    // Goal met - increment or maintain streak
    if (history.lastPeriodMet) {
      history.currentStreak += 1;
    } else {
      history.currentStreak = 1;
    }
    history.totalAchieved += 1;
    history.bestStreak = Math.max(history.bestStreak, history.currentStreak);
  } else {
    // Goal not met - reset streak
    history.currentStreak = 0;
  }
  
  history.lastPeriodMet = goalMet;
  history.lastPeriodStart = getPeriodStart().toISOString().split('T')[0];

  // Track if any completed week came in under 50% of goal (for Overachiever badge)
  if (goalMet && periodCarbon <= goal.amount * 0.5) {
    history.halfGoalAchieved = true;
  }
  
  await updateGoalHistory(history);
  return history;
};

