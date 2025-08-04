import { z } from 'zod';
import { 
  Task, 
  NewTask, 
  UpdateTask, 
  TaskFilter, 
  TaskSort, 
  CompleteTask,
  insertTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  taskFilterSchema,
  taskSortSchema
} from '../db/schema/tasks';

// Create task request schema (for API)
export const createTaskSchema = insertTaskSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  actualDuration: true,
  bonusXP: true,
});

// Update task request schema (for API)
export const updateTaskRequestSchema = updateTaskSchema;

// Task query parameters schema
export const taskQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: taskSortSchema.optional(),
  filter: taskFilterSchema.optional(),
});

// Task statistics schema
export const taskStatsSchema = z.object({
  total: z.number(),
  completed: z.number(),
  pending: z.number(),
  inProgress: z.number(),
  overdue: z.number(),
  completionRate: z.number(),
});

// Types
export type CreateTaskRequest = z.infer<typeof createTaskSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type TaskStats = z.infer<typeof taskStatsSchema>;

// Re-export database types
export type { Task, NewTask, UpdateTask, TaskFilter, TaskSort, CompleteTask };

// Re-export schemas
export { completeTaskSchema };