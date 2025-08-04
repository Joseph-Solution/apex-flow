import { z } from 'zod';
import { 
  Habit, 
  NewHabit, 
  UpdateHabit, 
  HabitCompletion,
  NewHabitCompletion,
  HabitStats,
  HabitFilter,
  insertHabitSchema,
  updateHabitSchema,
  insertHabitCompletionSchema,
  habitStatsSchema,
  habitFilterSchema
} from '../db/schema/habits';

// Create habit request schema (for API)
export const createHabitSchema = insertHabitSchema.omit({
  id: true,
  userId: true,
  currentStreak: true,
  longestStreak: true,
  totalCompletions: true,
  createdAt: true,
  updatedAt: true,
  lastCompletedAt: true,
  isPaused: true,
  pausedAt: true,
  pauseReason: true,
});

// Update habit request schema (for API)
export const updateHabitRequestSchema = updateHabitSchema;

// Habit query parameters schema
export const habitQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  filter: habitFilterSchema.optional(),
  sortBy: z.enum(['name', 'createdAt', 'currentStreak', 'longestStreak', 'lastCompletedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Complete habit request schema
export const completeHabitSchema = insertHabitCompletionSchema.omit({
  id: true,
  habitId: true,
  userId: true,
  completedAt: true,
  streakAtCompletion: true,
  xpAwarded: true,
  bonusXPAwarded: true,
  createdAt: true,
}).extend({
  completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

// Habit frequency calculation schema
export const habitFrequencyCalculationSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'custom']),
  customFrequency: z.object({
    type: z.enum(['days_per_week', 'times_per_week', 'times_per_month']),
    value: z.number().min(1),
    specificDays: z.array(z.number().min(0).max(6)).optional(),
  }).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

// Habit analytics request schema
export const habitAnalyticsSchema = z.object({
  habitId: z.string().uuid(),
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

// Habit streak analysis schema
export const habitStreakAnalysisSchema = z.object({
  currentStreak: z.number(),
  longestStreak: z.number(),
  streakHistory: z.array(z.object({
    startDate: z.string(),
    endDate: z.string(),
    length: z.number(),
  })),
  averageStreakLength: z.number(),
  streakBreaks: z.number(),
});

// Habit completion rate schema
export const habitCompletionRateSchema = z.object({
  period: z.string(),
  completionRate: z.number(),
  expectedCompletions: z.number(),
  actualCompletions: z.number(),
  missedDays: z.number(),
});

// Types
export type CreateHabitRequest = z.infer<typeof createHabitSchema>;
export type UpdateHabitRequest = z.infer<typeof updateHabitRequestSchema>;
export type HabitQuery = z.infer<typeof habitQuerySchema>;
export type CompleteHabitRequest = z.infer<typeof completeHabitSchema>;
export type HabitFrequencyCalculation = z.infer<typeof habitFrequencyCalculationSchema>;
export type HabitAnalyticsRequest = z.infer<typeof habitAnalyticsSchema>;
export type HabitStreakAnalysis = z.infer<typeof habitStreakAnalysisSchema>;
export type HabitCompletionRate = z.infer<typeof habitCompletionRateSchema>;

// Re-export database types
export type { Habit, NewHabit, UpdateHabit, HabitCompletion, NewHabitCompletion, HabitStats, HabitFilter };