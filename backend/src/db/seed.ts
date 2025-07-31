import { db, checkDatabaseConnection, closeDatabaseConnection } from './connection';
import { achievements, notificationTemplates } from './schema';

// Default achievements to seed
const defaultAchievements = [
  // Task achievements
  {
    name: 'First Steps',
    description: 'Complete your first task',
    icon: '🎯',
    category: 'tasks' as const,
    rarity: 'common' as const,
    xpReward: 25,
    criteria: {
      type: 'task_count' as const,
      target: 1,
      timeframe: 'all_time' as const,
    },
    badgeColor: '#10B981',
  },
  {
    name: 'Task Master',
    description: 'Complete 100 tasks',
    icon: '🏆',
    category: 'tasks' as const,
    rarity: 'epic' as const,
    xpReward: 200,
    criteria: {
      type: 'task_count' as const,
      target: 100,
      timeframe: 'all_time' as const,
    },
    badgeColor: '#8B5CF6',
  },
  
  // Habit achievements
  {
    name: 'Habit Starter',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    category: 'habits' as const,
    rarity: 'common' as const,
    xpReward: 50,
    criteria: {
      type: 'habit_streak' as const,
      target: 7,
      timeframe: 'all_time' as const,
    },
    badgeColor: '#F59E0B',
  },
  {
    name: 'Streak Legend',
    description: 'Maintain a 100-day streak',
    icon: '🌟',
    category: 'habits' as const,
    rarity: 'legendary' as const,
    xpReward: 500,
    criteria: {
      type: 'habit_streak' as const,
      target: 100,
      timeframe: 'all_time' as const,
    },
    badgeColor: '#FFD700',
  },
  
  // Goal achievements
  {
    name: 'Goal Getter',
    description: 'Complete your first goal',
    icon: '🎖️',
    category: 'goals' as const,
    rarity: 'common' as const,
    xpReward: 100,
    criteria: {
      type: 'goal_completion' as const,
      target: 1,
      timeframe: 'all_time' as const,
    },
    badgeColor: '#06B6D4',
  },
  
  // Level achievements
  {
    name: 'Rising Star',
    description: 'Reach level 10',
    icon: '⭐',
    category: 'levels' as const,
    rarity: 'rare' as const,
    xpReward: 150,
    criteria: {
      type: 'level_reached' as const,
      target: 10,
      timeframe: 'all_time' as const,
    },
    badgeColor: '#EC4899',
  },
  
  // Special achievements
  {
    name: 'Early Bird',
    description: 'Complete a task before 8 AM',
    icon: '🌅',
    category: 'special' as const,
    rarity: 'rare' as const,
    xpReward: 75,
    criteria: {
      type: 'custom' as const,
      target: 1,
      timeframe: 'all_time' as const,
      conditions: { completionTime: 'before_8am' },
    },
    badgeColor: '#F97316',
  },
];

// Default notification templates
const defaultNotificationTemplates = [
  {
    name: 'task_reminder_default',
    type: 'task_reminder' as const,
    titleTemplate: 'Task Reminder: {{taskTitle}}',
    messageTemplate: 'Don\'t forget about your task "{{taskTitle}}" due {{dueDate}}!',
    defaultPriority: 'medium' as const,
    defaultChannels: {
      inApp: true,
      email: false,
      push: true,
    },
    variables: [
      { name: 'taskTitle', type: 'string' as const, required: true, description: 'The title of the task' },
      { name: 'dueDate', type: 'date' as const, required: true, description: 'The due date of the task' },
    ],
    category: 'tasks',
  },
  {
    name: 'habit_reminder_default',
    type: 'habit_reminder' as const,
    titleTemplate: 'Time for {{habitName}}!',
    messageTemplate: 'Keep your streak going! Time to complete "{{habitName}}" (Current streak: {{currentStreak}} days)',
    defaultPriority: 'medium' as const,
    defaultChannels: {
      inApp: true,
      email: false,
      push: true,
    },
    variables: [
      { name: 'habitName', type: 'string' as const, required: true, description: 'The name of the habit' },
      { name: 'currentStreak', type: 'number' as const, required: true, description: 'Current streak count' },
    ],
    category: 'habits',
  },
  {
    name: 'achievement_unlocked_default',
    type: 'achievement_unlocked' as const,
    titleTemplate: '🎉 Achievement Unlocked!',
    messageTemplate: 'Congratulations! You\'ve unlocked "{{achievementName}}" and earned {{xpReward}} XP!',
    defaultPriority: 'high' as const,
    defaultChannels: {
      inApp: true,
      email: false,
      push: true,
    },
    variables: [
      { name: 'achievementName', type: 'string' as const, required: true, description: 'The name of the achievement' },
      { name: 'xpReward', type: 'number' as const, required: true, description: 'XP reward amount' },
    ],
    category: 'achievements',
  },
  {
    name: 'level_up_default',
    type: 'level_up' as const,
    titleTemplate: '🚀 Level Up!',
    messageTemplate: 'Amazing! You\'ve reached level {{newLevel}}! Keep up the great work!',
    defaultPriority: 'high' as const,
    defaultChannels: {
      inApp: true,
      email: false,
      push: true,
    },
    variables: [
      { name: 'newLevel', type: 'number' as const, required: true, description: 'The new level reached' },
    ],
    category: 'gamification',
  },
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Check database connection
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    
    console.log('✅ Database connection established');
    
    // Try to seed achievements (skip if table doesn't exist)
    try {
      console.log('📊 Seeding achievements...');
      for (const achievement of defaultAchievements) {
        try {
          await db.insert(achievements).values(achievement).onConflictDoNothing();
          console.log(`  ✅ Added achievement: ${achievement.name}`);
        } catch (error) {
          console.log(`  ⚠️  Achievement ${achievement.name} already exists`);
        }
      }
    } catch (error) {
      console.log('⚠️  Achievements table not ready, skipping...');
    }
    
    // Try to seed notification templates (skip if table doesn't exist)
    try {
      console.log('📧 Seeding notification templates...');
      for (const template of defaultNotificationTemplates) {
        try {
          await db.insert(notificationTemplates).values(template).onConflictDoNothing();
          console.log(`  ✅ Added template: ${template.name}`);
        } catch (error) {
          console.log(`  ⚠️  Template ${template.name} already exists`);
        }
      }
    } catch (error) {
      console.log('⚠️  Notification templates table not ready, skipping...');
    }
    
    console.log('✅ Database seeding completed successfully');
  } catch (error) {
    console.log('⚠️  Seeding completed with warnings:', error.message);
  } finally {
    await closeDatabaseConnection();
    console.log('🔌 Database connection closed');
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

export { seedDatabase };