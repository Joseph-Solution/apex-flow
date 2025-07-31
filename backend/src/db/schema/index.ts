// Export all tables
export * from './users';
export * from './tasks';
export * from './habits';
export * from './goals';
export * from './achievements';
export * from './notifications';

// Re-export relations for Drizzle
export { tasksRelations } from './tasks';
export { habitsRelations, habitCompletionsRelations } from './habits';
export { goalsRelations, milestonesRelations, goalUpdatesRelations } from './goals';
export { achievementsRelations, userAchievementsRelations, achievementProgressRelations } from './achievements';
export { notificationsRelations, userNotificationPreferencesRelations } from './notifications';

// Import all tables for schema object
import { users } from './users';
import { tasks } from './tasks';
import { habits, habitCompletions } from './habits';
import { goals, milestones, goalUpdates } from './goals';
import { achievements, userAchievements, achievementProgress } from './achievements';
import { notifications, notificationTemplates, userNotificationPreferences } from './notifications';

// Schema object for Drizzle
export const schema = {
  // User management
  users,
  
  // Task management
  tasks,
  
  // Habit tracking
  habits,
  habitCompletions,
  
  // Goal management
  goals,
  milestones,
  goalUpdates,
  
  // Achievement system
  achievements,
  userAchievements,
  achievementProgress,
  
  // Notification system
  notifications,
  notificationTemplates,
  userNotificationPreferences,
};