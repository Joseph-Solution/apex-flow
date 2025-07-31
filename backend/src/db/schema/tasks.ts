import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users } from './users';

// Task priority and status enums
export const taskPriorityEnum = ['low', 'medium', 'high', 'urgent'] as const;
export const taskStatusEnum = ['pending', 'in_progress', 'completed', 'cancelled'] as const;

// Tasks table
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Task details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  priority: varchar('priority', { length: 10 }).$type<typeof taskPriorityEnum[number]>().default('medium').notNull(),
  status: varchar('status', { length: 15 }).$type<typeof taskStatusEnum[number]>().default('pending').notNull(),
  
  // Scheduling
  dueDate: timestamp('due_date'),
  estimatedDuration: integer('estimated_duration'), // in minutes
  actualDuration: integer('actual_duration'), // in minutes
  
  // Completion tracking
  completedAt: timestamp('completed_at'),
  completionNotes: text('completion_notes'),
  
  // Gamification
  xpReward: integer('xp_reward').default(0).notNull(),
  bonusXP: integer('bonus_xp').default(0), // For early completion, etc.
  
  // Organization
  tags: jsonb('tags').$type<string[]>().default([]),
  category: varchar('category', { length: 50 }),
  
  // Metadata
  isRecurring: boolean('is_recurring').default(false).notNull(),
  recurringConfig: jsonb('recurring_config').$type<{
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    daysOfWeek?: number[];
    endDate?: string;
  }>(),
  parentTaskId: uuid('parent_task_id'), // For subtasks
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Self-referencing relation for subtasks
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, {
    relationName: 'subtasks',
  }),
}));

// Zod schemas for validation
export const insertTaskSchema = createInsertSchema(tasks, {
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  priority: z.enum(taskPriorityEnum),
  status: z.enum(taskStatusEnum),
  dueDate: z.string().datetime().optional().or(z.date().optional()),
  estimatedDuration: z.number().min(1, 'Duration must be at least 1 minute').optional(),
  tags: z.array(z.string()).default([]),
  category: z.string().max(50).optional(),
});

export const selectTaskSchema = createSelectSchema(tasks);

export const updateTaskSchema = insertTaskSchema.partial().omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Task completion schema
export const completeTaskSchema = z.object({
  completionNotes: z.string().max(500).optional(),
  actualDuration: z.number().min(1).optional(),
});

// Task filtering schema
export const taskFilterSchema = z.object({
  status: z.enum(taskStatusEnum).optional(),
  priority: z.enum(taskPriorityEnum).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  isOverdue: z.boolean().optional(),
});

// Task sorting schema
export const taskSortSchema = z.object({
  field: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title']),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

// Types
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type TaskFilter = z.infer<typeof taskFilterSchema>;
export type TaskSort = z.infer<typeof taskSortSchema>;
export type CompleteTask = z.infer<typeof completeTaskSchema>;