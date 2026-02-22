/**
 * Achievement definitions and unlock logic
 *
 * Each achievement has a check() that returns true when the user has earned it.
 * check() receives a single context object so callers don't need to know internals.
 */

/**
 * @typedef {Object} AchievementContext
 * @property {Object|null} goal          - Current goal from goal-storage
 * @property {Object}      history       - Goal history (streak, totalAchieved, etc.)
 * @property {Object}      totalImpact   - All-time totals from getTotalImpact()
 * @property {number}      weekCarbon    - Carbon tracked so far this week (grams)
 */

export const ACHIEVEMENTS = [
  {
    id: 'first_step',
    emoji: '🌱',
    name: 'First Step',
    description: 'Set your first carbon goal',
    check: ({ goal }) => goal !== null,
  },
  {
    id: 'on_track',
    emoji: '✅',
    name: 'On Track',
    description: 'Meet your weekly goal for the first time',
    check: ({ history }) => (history.totalAchieved ?? 0) >= 1,
  },
  {
    id: 'streak_starter',
    emoji: '🔥',
    name: 'Streak Starter',
    description: 'Meet your weekly goal 2 weeks in a row',
    check: ({ history }) => (history.bestStreak ?? 0) >= 2,
  },
  {
    id: 'hat_trick',
    emoji: '🏆',
    name: 'Hat Trick',
    description: 'Meet your weekly goal 3 weeks in a row',
    check: ({ history }) => (history.bestStreak ?? 0) >= 3,
  },
  {
    id: 'eco_warrior',
    emoji: '🌿',
    name: 'Eco Warrior',
    description: 'Set the Eco Warrior goal (350g/week)',
    check: ({ goal }) => goal?.amount === 350,
  },
  {
    id: 'overachiever',
    emoji: '⚡',
    name: 'Overachiever',
    description: 'Finish a week using less than 50% of your goal',
    check: ({ goal, history, weekCarbon }) => {
      // Only counts if the week is actually finished (at least one completed period)
      // and that period was under 50%. We track this via a custom flag in history.
      return (history.halfGoalAchieved ?? false) === true;
    },
  },
  {
    id: 'data_nerd',
    emoji: '📊',
    name: 'Data Nerd',
    description: 'Track 500g of carbon total',
    check: ({ totalImpact }) => (totalImpact.totalCarbon ?? 0) >= 500,
  },
  {
    id: 'carbon_conscious',
    emoji: '🌍',
    name: 'Carbon Conscious',
    description: 'Track 5,000g of carbon total',
    check: ({ totalImpact }) => (totalImpact.totalCarbon ?? 0) >= 5000,
  },
];

/**
 * Compare current state against all achievement definitions.
 * Returns an array of IDs that are currently earned.
 *
 * @param {AchievementContext} context
 * @returns {string[]} Earned achievement IDs
 */
export const getEarnedIds = (context) => {
  return ACHIEVEMENTS
    .filter(a => {
      try { return a.check(context); }
      catch { return false; }
    })
    .map(a => a.id);
};
