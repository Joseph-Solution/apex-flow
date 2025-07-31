import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users } from './users';

// Notification type enum
export const notificationTypeEnum = [
  'task_reminder',
  'task_overdue',
  'habit_reminder',
  'habit_streak_milestone',
  'goal_deadline',
  'goal_milestone',
  'achievement_unlocked',
  'level_up',
  'weekly_report',
  'motivational_checkin',
  'system_announcement'
] as const;

// Notification priority enum
export const notificationPriorityEnum = ['low', 'medium', 'high', 'urgent'] as const;

// Notification status enum
export const notificationStatusEnum = ['pending', 'sent', 'delivered', 'read', 'failed'] as const;

// Notifications table
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Notification details
  type: varchar('type', { length: 30 }).$type<typeof notificationTypeEnum[number]>().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  
  // Priority and scheduling
  priority: varchar('priority', { length: 10 }).$type<typeof notificationPriorityEnum[number]>().default('medium').notNull(),
  scheduledFor: timestamp('scheduled_for').defaultNow().notNull(),
  
  // Status tracking
  status: varchar('status', { length: 15 }).$type<typeof notificationStatusEnum[number]>().default('pending').notNull(),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  
  // Related entities
  relatedEntityType: varchar('related_entity_type', { length: 20 }), // task, habit, goal, achievement
  relatedEntityId: uuid('related_entity_id'),
  
  // Notification data
  data: jsonb('data').$type<Record<string, any>>().default({}), // Additional data for the notification
  
  // Delivery settings
  channels: jsonb('channels').$type<{
    inApp: boolean;
    email: boolean;
    push: boolean;
  }>().default({
    inApp: true,
    email: false,
    push: false
  }),
  
  // Metadata
  isRead: boolean('is_read').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  expiresAt: timestamp('expires_at'), // Auto-delete after this date
  
  // Error tracking
  failureReason: text('failure_reason'),
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Notification templates table (for reusable notification templates)
export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Template details
  name: varchar('name', { length: 255 }).notNull().unique(),
  type: varchar('type', { length: 30 }).$type<typeof notificationTypeEnum[number]>().notNull(),
  
  // Template content
  titleTemplate: varchar('title_template', { length: 255 }).notNull(),
  messageTemplate: text('message_template').notNull(),
  
  // Default settings
  defaultPriority: varchar('default_priority', { length: 10 }).$type<typeof notificationPriorityEnum[number]>().default('medium').notNull(),
  defaultChannels: jsonb('default_channels').$type<{
    inApp: boolean;
    email: boolean;
    push: boolean;
  }>().default({
    inApp: true,
    email: false,
    push: false
  }),
  
  // Template variables
  variables: jsonb('variables').$type<{
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    required: boolean;
    description?: string;
  }[]>().default([]),
  
  // Metadata
  isActive: boolean('is_active').default(true).notNull(),
  category: varchar('category', { length: 50 }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User notification preferences table
export const userNotificationPreferences = pgTable('user_notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  
  // Global preferences
  globalEnabled: boolean('global_enabled').default(true).notNull(),
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }).default('22:00'), // HH:MM
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }).default('08:00'), // HH:MM
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  
  // Channel preferences
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
  
  // Type-specific preferences
  preferences: jsonb('preferences').$type<Record<typeof notificationTypeEnum[number], {
    enabled: boolean;
    channels: {
      inApp: boolean;
      email: boolean;
      push: boolean;
    };
    frequency?: 'immediate' | 'daily_digest' | 'weekly_digest';
  }>>().default({
    task_reminder: { enabled: true, channels: { inApp: true, email: false, push: true } },
    task_overdue: { enabled: true, channels: { inApp: true, email: true, push: true } },
    habit_reminder: { enabled: true, channels: { inApp: true, email: false, push: true } },
    habit_streak_milestone: { enabled: true, channels: { inApp: true, email: false, push: true } },
    goal_deadline: { enabled: true, channels: { inApp: true, email: true, push: true } },
    goal_milestone: { enabled: true, channels: { inApp: true, email: false, push: true } },
    achievement_unlocked: { enabled: true, channels: { inApp: true, email: false, push: true } },
    level_up: { enabled: true, channels: { inApp: true, email: false, push: true } },
    weekly_report: { enabled: true, channels: { inApp: true, email: true, push: false } },
    motivational_checkin: { enabled: true, channels: { inApp: true, email: false, push: false } },
    system_announcement: { enabled: true, channels: { inApp: true, email: true, push: false } }
  }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertNotificationSchema = createInsertSchema(notifications, {
  type: z.enum(notificationTypeEnum),
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  message: z.string().min(1, 'Message is required').max(1000, 'Message must be less than 1000 characters'),
  priority: z.enum(notificationPriorityEnum),
  scheduledFor: z.string().datetime().or(z.date()).optional(),
  relatedEntityType: z.enum(['task', 'habit', 'goal', 'achievement']).optional(),
  relatedEntityId: z.string().uuid().optional(),
});

export const selectNotificationSchema = createSelectSchema(notifications);

export const updateNotificationSchema = insertNotificationSchema.partial().omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Notification template schemas
export const insertNotificationTemplateSchema = createInsertSchema(notificationTemplates, {
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  type: z.enum(notificationTypeEnum),
  titleTemplate: z.string().min(1, 'Title template is required').max(255, 'Title template must be less than 255 characters'),
  messageTemplate: z.string().min(1, 'Message template is required').max(1000, 'Message template must be less than 1000 characters'),
  defaultPriority: z.enum(notificationPriorityEnum),
});

export const selectNotificationTemplateSchema = createSelectSchema(notificationTemplates);

// User notification preferences schemas
export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences, {
  quietHoursStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
  quietHoursEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
  timezone: z.string().optional(),
});

export const selectUserNotificationPreferencesSchema = createSelectSchema(userNotificationPreferences);

export const updateUserNotificationPreferencesSchema = insertUserNotificationPreferencesSchema.partial().omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Notification filtering schema
export const notificationFilterSchema = z.object({
  type: z.enum(notificationTypeEnum).optional(),
  priority: z.enum(notificationPriorityEnum).optional(),
  status: z.enum(notificationStatusEnum).optional(),
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  relatedEntityType: z.enum(['task', 'habit', 'goal', 'achievement']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Types
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type UpdateNotification = z.infer<typeof updateNotificationSchema>;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type NewUserNotificationPreferences = typeof userNotificationPreferences.$inferInsert;
export type UpdateUserNotificationPreferences = z.infer<typeof updateUserNotificationPreferencesSchema>;
export type NotificationFilter = z.infer<typeof notificationFilterSchema>;