import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  
  // Profile information
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  
  // Gamification profile
  level: integer('level').default(1).notNull(),
  totalXP: integer('total_xp').default(0).notNull(),
  currentLevelXP: integer('current_level_xp').default(0).notNull(),
  nextLevelXP: integer('next_level_xp').default(100).notNull(),
  
  // Avatar and customization
  avatarConfig: jsonb('avatar_config').$type<{
    baseAvatar: string;
    accessories: string[];
    colors: Record<string, string>;
  }>().default({
    baseAvatar: 'default',
    accessories: [],
    colors: {}
  }),
  
  unlockedItems: jsonb('unlocked_items').$type<string[]>().default([]),
  
  // User preferences
  preferences: jsonb('preferences').$type<{
    notifications: {
      taskReminders: boolean;
      habitReminders: boolean;
      achievements: boolean;
      weeklyReports: boolean;
    };
    theme: 'light' | 'dark' | 'auto';
    language: string;
    workingHours: {
      start: string;
      end: string;
    };
  }>().default({
    notifications: {
      taskReminders: true,
      habitReminders: true,
      achievements: true,
      weeklyReports: true
    },
    theme: 'auto',
    language: 'en',
    workingHours: {
      start: '09:00',
      end: '17:00'
    }
  }),
  
  // Account status
  isActive: boolean('is_active').default(true).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters'),
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100).optional(),
  timezone: z.string().optional(),
});

export const selectUserSchema = createSelectSchema(users);

export const updateUserSchema = insertUserSchema.partial().omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
});

// Public user schema (without sensitive data)
export const publicUserSchema = selectUserSchema.omit({
  passwordHash: true,
  emailVerificationToken: true,
  passwordResetToken: true,
  passwordResetExpires: true,
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;