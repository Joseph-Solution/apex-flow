import { UserRepository } from '../repositories/UserRepository';
import { User, UpdateUser, PublicUser } from '../db/schema/users';
import { z } from 'zod';

// Profile update schema
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100).optional(),
  timezone: z.string().optional(),
  avatarConfig: z.object({
    baseAvatar: z.string(),
    accessories: z.array(z.string()),
    colors: z.record(z.string()),
  }).optional(),
  preferences: z.object({
    notifications: z.object({
      taskReminders: z.boolean(),
      habitReminders: z.boolean(),
      achievements: z.boolean(),
      weeklyReports: z.boolean(),
    }),
    theme: z.enum(['light', 'dark', 'auto']),
    language: z.string(),
    workingHours: z.object({
      start: z.string(),
      end: z.string(),
    }),
  }).optional(),
});

// Avatar customization schema
export const avatarCustomizationSchema = z.object({
  baseAvatar: z.string().min(1, 'Base avatar is required'),
  accessories: z.array(z.string()).default([]),
  colors: z.record(z.string()).default({}),
});

// User preferences schema
export const userPreferencesSchema = z.object({
  notifications: z.object({
    taskReminders: z.boolean().default(true),
    habitReminders: z.boolean().default(true),
    achievements: z.boolean().default(true),
    weeklyReports: z.boolean().default(true),
  }).default({
    taskReminders: true,
    habitReminders: true,
    achievements: true,
    weeklyReports: true,
  }),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  language: z.string().default('en'),
  workingHours: z.object({
    start: z.string().default('09:00'),
    end: z.string().default('17:00'),
  }).default({
    start: '09:00',
    end: '17:00',
  }),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type AvatarCustomization = z.infer<typeof avatarCustomizationSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export class UserProfileService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Get user profile (public data only)
   */
  async getProfile(userId: string): Promise<PublicUser | null> {
    return await this.userRepository.getPublicUser(userId);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, profileData: UpdateProfileRequest): Promise<PublicUser | null> {
    // Validate the profile data
    const validatedData = updateProfileSchema.parse(profileData);

    // Update the user profile
    const updatedUser = await this.userRepository.update(userId, validatedData);
    
    if (!updatedUser) {
      return null;
    }

    // Return public user data
    return await this.userRepository.getPublicUser(userId);
  }

  /**
   * Update avatar configuration
   */
  async updateAvatar(userId: string, avatarConfig: AvatarCustomization): Promise<PublicUser | null> {
    // Validate avatar configuration
    const validatedAvatar = avatarCustomizationSchema.parse(avatarConfig);

    // Update the user's avatar configuration
    const updatedUser = await this.userRepository.update(userId, {
      avatarConfig: validatedAvatar,
    });

    if (!updatedUser) {
      return null;
    }

    return await this.userRepository.getPublicUser(userId);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: UserPreferences): Promise<PublicUser | null> {
    // Validate preferences
    const validatedPreferences = userPreferencesSchema.parse(preferences);

    // Update the user's preferences
    const updatedUser = await this.userRepository.update(userId, {
      preferences: validatedPreferences,
    });

    if (!updatedUser) {
      return null;
    }

    return await this.userRepository.getPublicUser(userId);
  }

  /**
   * Get user's unlocked avatar items
   */
  async getUnlockedItems(userId: string): Promise<string[]> {
    const user = await this.userRepository.findById(userId);
    return user?.unlockedItems || [];
  }

  /**
   * Add unlocked items to user (used by achievement system)
   */
  async addUnlockedItems(userId: string, items: string[]): Promise<PublicUser | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    // Merge new items with existing unlocked items (avoid duplicates)
    const currentItems = user.unlockedItems || [];
    const newItems = [...new Set([...currentItems, ...items])];

    const updatedUser = await this.userRepository.update(userId, {
      unlockedItems: newItems,
    });

    if (!updatedUser) {
      return null;
    }

    return await this.userRepository.getPublicUser(userId);
  }

  /**
   * Get user statistics for profile display
   */
  async getProfileStats(userId: string): Promise<{
    level: number;
    totalXP: number;
    currentLevelXP: number;
    nextLevelXP: number;
    progressToNextLevel: number;
    unlockedItemsCount: number;
  } | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    const progressToNextLevel = user.nextLevelXP > 0 
      ? Math.round((user.currentLevelXP / user.nextLevelXP) * 100)
      : 100;

    return {
      level: user.level,
      totalXP: user.totalXP,
      currentLevelXP: user.currentLevelXP,
      nextLevelXP: user.nextLevelXP,
      progressToNextLevel,
      unlockedItemsCount: user.unlockedItems?.length || 0,
    };
  }

  /**
   * Validate if user can use specific avatar items
   */
  async validateAvatarItems(userId: string, items: string[]): Promise<{
    valid: boolean;
    invalidItems: string[];
  }> {
    const unlockedItems = await this.getUnlockedItems(userId);
    const invalidItems = items.filter(item => !unlockedItems.includes(item));

    return {
      valid: invalidItems.length === 0,
      invalidItems,
    };
  }

  /**
   * Reset avatar to default configuration
   */
  async resetAvatar(userId: string): Promise<PublicUser | null> {
    const defaultAvatar: AvatarCustomization = {
      baseAvatar: 'default',
      accessories: [],
      colors: {},
    };

    return await this.updateAvatar(userId, defaultAvatar);
  }

  /**
   * Get default user preferences
   */
  getDefaultPreferences(): UserPreferences {
    return userPreferencesSchema.parse({});
  }
}