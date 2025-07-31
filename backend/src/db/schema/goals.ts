import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users } from './users';

// Goal status enum
export const goalStatusEnum = ['active', 'completed', 'paused', 'cancelled'] as const;

// Goals table
export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Goal details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }),
  icon: varchar('icon', { length: 50 }).default('🎯'),
  color: varchar('color', { length: 7 }).default('#10B981'), // Hex color
  
  // Timeline
  targetDate: timestamp('target_date').notNull(),
  startDate: timestamp('start_date').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  
  // Progress tracking
  status: varchar('status', { length: 15 }).$type<typeof goalStatusEnum[number]>().default('active').notNull(),
  progress: decimal('progress', { precision: 5, scale: 2 }).default('0.00').notNull(), // 0-100 percentage
  
  // Gamification
  xpReward: integer('xp_reward').default(100).notNull(),
  bonusXPEarlyCompletion: integer('bonus_xp_early_completion').default(50),
  
  // Metadata
  priority: integer('priority').default(1).notNull(), // 1-5 scale
  isPublic: boolean('is_public').default(false).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Milestones table
export const milestones = pgTable('milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Milestone details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  order: integer('order').notNull(), // Order within the goal
  
  // Timeline
  targetDate: timestamp('target_date'),
  completedAt: timestamp('completed_at'),
  
  // Progress
  completed: boolean('completed').default(false).notNull(),
  progress: decimal('progress', { precision: 5, scale: 2 }).default('0.00').notNull(), // 0-100 percentage
  
  // Gamification
  xpReward: integer('xp_reward').default(25).notNull(),
  
  // Metadata
  notes: text('notes'),
  attachments: jsonb('attachments').$type<{
    type: 'link' | 'file' | 'image';
    url: string;
    name: string;
  }[]>().default([]),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Goal updates/journal entries table
export const goalUpdates = pgTable('goal_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Update details
  title: varchar('title', { length: 255 }),
  content: text('content').notNull(),
  updateType: varchar('update_type', { length: 20 }).default('progress'), // progress, reflection, milestone, setback
  
  // Progress snapshot
  progressBefore: decimal('progress_before', { precision: 5, scale: 2 }),
  progressAfter: decimal('progress_after', { precision: 5, scale: 2 }),
  
  // Metadata
  mood: integer('mood'), // 1-5 scale
  attachments: jsonb('attachments').$type<{
    type: 'link' | 'file' | 'image';
    url: string;
    name: string;
  }[]>().default([]),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
  milestones: many(milestones),
  updates: many(goalUpdates),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  goal: one(goals, {
    fields: [milestones.goalId],
    references: [goals.id],
  }),
  user: one(users, {
    fields: [milestones.userId],
    references: [users.id],
  }),
}));

export const goalUpdatesRelations = relations(goalUpdates, ({ one }) => ({
  goal: one(goals, {
    fields: [goalUpdates.goalId],
    references: [goals.id],
  }),
  user: one(users, {
    fields: [goalUpdates.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertGoalSchema = createInsertSchema(goals, {
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description must be less than 2000 characters'),
  targetDate: z.string().datetime().or(z.date()),
  startDate: z.string().datetime().or(z.date()).optional(),
  status: z.enum(goalStatusEnum),
  priority: z.number().min(1, 'Priority must be between 1 and 5').max(5, 'Priority must be between 1 and 5'),
  xpReward: z.number().min(1, 'XP reward must be at least 1').max(1000, 'XP reward cannot exceed 1000'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
  tags: z.array(z.string()).default([]),
});

export const selectGoalSchema = createSelectSchema(goals);

export const updateGoalSchema = insertGoalSchema.partial().omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

// Milestone schemas
export const insertMilestoneSchema = createInsertSchema(milestones, {
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  order: z.number().min(1, 'Order must be at least 1'),
  targetDate: z.string().datetime().or(z.date()).optional(),
  xpReward: z.number().min(1, 'XP reward must be at least 1').max(100, 'XP reward cannot exceed 100'),
});

export const selectMilestoneSchema = createSelectSchema(milestones);

export const updateMilestoneSchema = insertMilestoneSchema.partial().omit({
  id: true,
  goalId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

// Goal update schemas
export const insertGoalUpdateSchema = createInsertSchema(goalUpdates, {
  title: z.string().max(255, 'Title must be less than 255 characters').optional(),
  content: z.string().min(1, 'Content is required').max(2000, 'Content must be less than 2000 characters'),
  updateType: z.enum(['progress', 'reflection', 'milestone', 'setback']),
  mood: z.number().min(1, 'Mood must be between 1 and 5').max(5, 'Mood must be between 1 and 5').optional(),
});

export const selectGoalUpdateSchema = createSelectSchema(goalUpdates);

// Goal filtering schema
export const goalFilterSchema = z.object({
  status: z.enum(goalStatusEnum).optional(),
  category: z.string().optional(),
  priority: z.number().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  isOverdue: z.boolean().optional(),
});

// Goal analytics schema
export const goalAnalyticsSchema = z.object({
  totalGoals: z.number(),
  completedGoals: z.number(),
  activeGoals: z.number(),
  completionRate: z.number(), // Percentage
  averageCompletionTime: z.number(), // Days
  totalXPEarned: z.number(),
  goalsCompletedThisMonth: z.number(),
  goalsCompletedThisYear: z.number(),
});

// Types
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type UpdateGoal = z.infer<typeof updateGoalSchema>;
export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
export type UpdateMilestone = z.infer<typeof updateMilestoneSchema>;
export type GoalUpdate = typeof goalUpdates.$inferSelect;
export type NewGoalUpdate = typeof goalUpdates.$inferInsert;
export type GoalFilter = z.infer<typeof goalFilterSchema>;
export type GoalAnalytics = z.infer<typeof goalAnalyticsSchema>;