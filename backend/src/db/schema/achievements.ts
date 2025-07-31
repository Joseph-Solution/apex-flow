import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users } from './users';

// Achievement category enum
export const achievementCategoryEnum = ['tasks', 'habits', 'goals', 'streaks', 'levels', 'special'] as const;

// Achievement criteria type enum
export const achievementCriteriaTypeEnum = [
  'task_count',
  'habit_streak',
  'goal_completion',
  'level_reached',
  'xp_earned',
  'consecutive_days',
  'custom'
] as const;

// Achievements table (system-defined achievements)
export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Achievement details
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 50 }).default('🏆'),
  category: varchar('category', { length: 20 }).$type<typeof achievementCategoryEnum[number]>().notNull(),
  
  // Rarity and rewards
  rarity: varchar('rarity', { length: 10 }).default('common'), // common, rare, epic, legendary
  xpReward: integer('xp_reward').default(50).notNull(),
  
  // Unlock criteria
  criteria: jsonb('criteria').$type<{
    type: typeof achievementCriteriaTypeEnum[number];
    target: number;
    timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
    conditions?: Record<string, any>; // Additional conditions
  }>().notNull(),
  
  // Rewards and unlocks
  unlockedItems: jsonb('unlocked_items').$type<string[]>().default([]), // Avatar items, themes, etc.
  badgeColor: varchar('badge_color', { length: 7 }).default('#FFD700'), // Hex color
  
  // Metadata
  isActive: boolean('is_active').default(true).notNull(),
  isSecret: boolean('is_secret').default(false).notNull(), // Hidden until unlocked
  sortOrder: integer('sort_order').default(0).notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User achievements table (tracks which users have unlocked which achievements)
export const userAchievements = pgTable('user_achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: uuid('achievement_id').notNull().references(() => achievements.id, { onDelete: 'cascade' }),
  
  // Unlock details
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
  progress: integer('progress').default(0).notNull(), // Current progress towards achievement
  isCompleted: boolean('is_completed').default(false).notNull(),
  
  // Metadata
  unlockedValue: integer('unlocked_value'), // The actual value when unlocked (e.g., streak length)
  notes: text('notes'), // Optional notes about the achievement
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Achievement progress tracking table (for incremental achievements)
export const achievementProgress = pgTable('achievement_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: uuid('achievement_id').notNull().references(() => achievements.id, { onDelete: 'cascade' }),
  
  // Progress tracking
  currentProgress: integer('current_progress').default(0).notNull(),
  targetProgress: integer('target_progress').notNull(),
  progressPercentage: integer('progress_percentage').default(0).notNull(), // 0-100
  
  // Metadata
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  progressData: jsonb('progress_data').$type<Record<string, any>>().default({}), // Additional tracking data
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
  achievementProgress: many(achievementProgress),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

export const achievementProgressRelations = relations(achievementProgress, ({ one }) => ({
  user: one(users, {
    fields: [achievementProgress.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [achievementProgress.achievementId],
    references: [achievements.id],
  }),
}));

// Zod schemas for validation
export const insertAchievementSchema = createInsertSchema(achievements, {
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  category: z.enum(achievementCategoryEnum),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  xpReward: z.number().min(1, 'XP reward must be at least 1').max(1000, 'XP reward cannot exceed 1000'),
  badgeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
});

export const selectAchievementSchema = createSelectSchema(achievements);

export const updateAchievementSchema = insertAchievementSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// User achievement schemas
export const insertUserAchievementSchema = createInsertSchema(userAchievements, {
  progress: z.number().min(0, 'Progress cannot be negative'),
  unlockedValue: z.number().optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
});

export const selectUserAchievementSchema = createSelectSchema(userAchievements);

// Achievement progress schemas
export const insertAchievementProgressSchema = createInsertSchema(achievementProgress, {
  currentProgress: z.number().min(0, 'Progress cannot be negative'),
  targetProgress: z.number().min(1, 'Target progress must be at least 1'),
  progressPercentage: z.number().min(0, 'Percentage cannot be negative').max(100, 'Percentage cannot exceed 100'),
});

export const selectAchievementProgressSchema = createSelectSchema(achievementProgress);

// Achievement filtering schema
export const achievementFilterSchema = z.object({
  category: z.enum(achievementCategoryEnum).optional(),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']).optional(),
  isCompleted: z.boolean().optional(),
  isSecret: z.boolean().optional(),
});

// Achievement statistics schema
export const achievementStatsSchema = z.object({
  totalAchievements: z.number(),
  unlockedAchievements: z.number(),
  completionRate: z.number(), // Percentage
  totalXPFromAchievements: z.number(),
  rareAchievements: z.number(),
  epicAchievements: z.number(),
  legendaryAchievements: z.number(),
  recentUnlocks: z.array(z.object({
    achievementId: z.string(),
    name: z.string(),
    unlockedAt: z.string(),
  })),
});

// Types
export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
export type UpdateAchievement = z.infer<typeof updateAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = typeof userAchievements.$inferInsert;
export type AchievementProgress = typeof achievementProgress.$inferSelect;
export type NewAchievementProgress = typeof achievementProgress.$inferInsert;
export type AchievementFilter = z.infer<typeof achievementFilterSchema>;
export type AchievementStats = z.infer<typeof achievementStatsSchema>;