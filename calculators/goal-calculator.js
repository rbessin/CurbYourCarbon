/**
 * Goal calculation and progress logic
 * 
 * Pure functions for goal calculations, progress, and streaks
 */

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

