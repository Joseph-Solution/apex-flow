import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, date } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users } from './users';

// Habit frequency enum
export const habitFrequencyEnum = ['daily', 'weekly', 'custom'] as const;

// Habits table
export const habits = pgTable('habits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Habit details
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }),
  icon: varchar('icon', { length: 50 }).default('🎯'),
  color: varchar('color', { length: 7 }).default('#3B82F6'), // Hex color
  
  // Frequency configuration
  frequency: varchar('frequency', { length: 10 }).$type<typeof habitFrequencyEnum[number]>().default('daily').notNull(),
  customFrequency: jsonb('custom_frequency').$type<{
    type: 'days_per_week' | 'times_per_week' | 'times_per_month';
    value: number;
    specificDays?: number[]; // 0-6, Sunday = 0
  }>(),
  
  // Streak tracking
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  totalCompletions: integer('total_completions').default(0).notNull(),
  
  // Target and goals
  targetStreak: integer('target_streak').default(30).notNull(),
  targetCompletionsPerWeek: integer('target_completions_per_week'),
  
  // Gamification
  xpPerCompletion: integer('xp_per_completion').default(10).notNull(),
  bonusXPStreak: integer('bonus_xp_streak').default(5), // Bonus XP for maintaining streaks
  
  // Scheduling
  reminderTime: varchar('reminder_time', { length: 5 }), // HH:MM format
  reminderDays: jsonb('reminder_days').$type<number[]>().default([]), // Days of week for reminders
  
  // Status and metadata
  isActive: boolean('is_active').default(true).notNull(),
  isPaused: boolean('is_paused').default(false).notNull(),
  pausedAt: timestamp('paused_at'),
  pauseReason: text('pause_reason'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastCompletedAt: timestamp('last_completed_at'),
});

// Habit completions table for tracking daily completions
export const habitCompletions = pgTable('habit_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  habitId: uuid('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Completion details
  completedDate: date('completed_date').notNull(), // Date only, not timestamp
  completedAt: timestamp('completed_at').defaultNow().notNull(),
  notes: text('notes'),
  mood: integer('mood'), // 1-5 scale for tracking mood during completion
  
  // Streak information at time of completion
  streakAtCompletion: integer('streak_at_completion').notNull(),
  xpAwarded: integer('xp_awarded').default(0).notNull(),
  bonusXPAwarded: integer('bonus_xp_awarded').default(0).notNull(),
  
  // Metadata
  completionMethod: varchar('completion_method', { length: 20 }).default('manual'), // manual, automatic, imported
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(users, {
    fields: [habits.userId],
    references: [users.id],
  }),
  completions: many(habitCompletions),
}));

export const habitCompletionsRelations = relations(habitCompletions, ({ one }) => ({
  habit: one(habits, {
    fields: [habitCompletions.habitId],
    references: [habits.id],
  }),
  user: one(users, {
    fields: [habitCompletions.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertHabitSchema = createInsertSchema(habits, {
  name: z.string().min(1, 'Habit name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  frequency: z.enum(habitFrequencyEnum),
  targetStreak: z.number().min(1, 'Target streak must be at least 1').max(365, 'Target streak cannot exceed 365 days'),
  xpPerCompletion: z.number().min(1, 'XP reward must be at least 1').max(100, 'XP reward cannot exceed 100'),
  reminderTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
});

export const selectHabitSchema = createSelectSchema(habits);

export const updateHabitSchema = insertHabitSchema.partial().omit({
  id: true,
  userId: true,
  currentStreak: true,
  longestStreak: true,
  totalCompletions: true,
  createdAt: true,
  updatedAt: true,
  lastCompletedAt: true,
});

// Habit completion schemas
export const insertHabitCompletionSchema = createInsertSchema(habitCompletions, {
  completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  mood: z.number().min(1, 'Mood must be between 1 and 5').max(5, 'Mood must be between 1 and 5').optional(),
});

export const selectHabitCompletionSchema = createSelectSchema(habitCompletions);

// Habit analytics schemas
export const habitStatsSchema = z.object({
  totalCompletions: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  completionRate: z.number(), // Percentage
  averageMood: z.number().optional(),
  weeklyCompletions: z.array(z.number()), // Last 7 days
  monthlyCompletions: z.array(z.number()), // Last 30 days
});

// Habit filtering schema
export const habitFilterSchema = z.object({
  category: z.string().optional(),
  frequency: z.enum(habitFrequencyEnum).optional(),
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
});

// Types
export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
export type UpdateHabit = z.infer<typeof updateHabitSchema>;
export type HabitCompletion = typeof habitCompletions.$inferSelect;
export type NewHabitCompletion = typeof habitCompletions.$inferInsert;
export type HabitStats = z.infer<typeof habitStatsSchema>;
export type HabitFilter = z.infer<typeof habitFilterSchema>;