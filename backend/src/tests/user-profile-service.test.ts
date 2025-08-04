import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UserProfileService, updateProfileSchema, avatarCustomizationSchema, userPreferencesSchema } from '../services/UserProfileService';
import { UserRepository } from '../repositories/UserRepository';
import { User, PublicUser } from '../db/schema/users';

// Mock the UserRepository
jest.mock('../repositories/UserRepository');

describe('UserProfileService', () => {
  let userProfileService: UserProfileService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    timezone: 'UTC',
    level: 5,
    totalXP: 1250,
    currentLevelXP: 250,
    nextLevelXP: 500,
    avatarConfig: {
      baseAvatar: 'warrior',
      accessories: ['sword', 'shield'],
      colors: { primary: '#ff0000', secondary: '#00ff00' }
    },
    unlockedItems: ['warrior', 'sword', 'shield', 'mage-hat'],
    preferences: {
      notifications: {
        taskReminders: true,
        habitReminders: true,
        achievements: true,
        weeklyReports: false
      },
      theme: 'dark' as const,
      language: 'en',
      workingHours: {
        start: '08:00',
        end: '18:00'
      }
    },
    isActive: true,
    emailVerified: true,
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    lastLoginAt: new Date('2024-01-15')
  };

  const mockPublicUser: PublicUser = {
    id: mockUser.id,
    email: mockUser.email,
    username: mockUser.username,
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    timezone: mockUser.timezone,
    level: mockUser.level,
    totalXP: mockUser.totalXP,
    currentLevelXP: mockUser.currentLevelXP,
    nextLevelXP: mockUser.nextLevelXP,
    avatarConfig: mockUser.avatarConfig,
    unlockedItems: mockUser.unlockedItems,
    preferences: mockUser.preferences,
    isActive: mockUser.isActive,
    emailVerified: mockUser.emailVerified,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
    lastLoginAt: mockUser.lastLoginAt
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    userProfileService = new UserProfileService();
    // Replace the repository instance
    (userProfileService as any).userRepository = mockUserRepository;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      const result = await userProfileService.getProfile('user-123');

      expect(result).toEqual(mockPublicUser);
      expect(mockUserRepository.getPublicUser).toHaveBeenCalledWith('user-123');
    });

    it('should return null if user not found', async () => {
      mockUserRepository.getPublicUser.mockResolvedValue(null);

      const result = await userProfileService.getProfile('nonexistent');

      expect(result).toBeNull();
      expect(mockUserRepository.getPublicUser).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        timezone: 'America/New_York'
      };

      mockUserRepository.update.mockResolvedValue(mockUser);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      const result = await userProfileService.updateProfile('user-123', updateData);

      expect(result).toEqual(mockPublicUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', updateData);
      expect(mockUserRepository.getPublicUser).toHaveBeenCalledWith('user-123');
    });

    it('should return null if user not found', async () => {
      const updateData = { firstName: 'Jane' };

      mockUserRepository.update.mockResolvedValue(null);

      const result = await userProfileService.updateProfile('nonexistent', updateData);

      expect(result).toBeNull();
      expect(mockUserRepository.update).toHaveBeenCalledWith('nonexistent', updateData);
    });

    it('should validate profile data', async () => {
      const invalidData = { firstName: '' }; // Empty string should fail validation

      await expect(
        userProfileService.updateProfile('user-123', invalidData)
      ).rejects.toThrow();
    });
  });

  describe('updateAvatar', () => {
    it('should update avatar configuration successfully', async () => {
      const avatarConfig = {
        baseAvatar: 'mage',
        accessories: ['staff', 'robe'],
        colors: { primary: '#0000ff' }
      };

      mockUserRepository.update.mockResolvedValue(mockUser);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      const result = await userProfileService.updateAvatar('user-123', avatarConfig);

      expect(result).toEqual(mockPublicUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        avatarConfig
      });
    });

    it('should validate avatar configuration', async () => {
      const invalidConfig = { baseAvatar: '' }; // Empty string should fail

      await expect(
        userProfileService.updateAvatar('user-123', invalidConfig as any)
      ).rejects.toThrow();
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences successfully', async () => {
      const preferences = {
        notifications: {
          taskReminders: false,
          habitReminders: true,
          achievements: true,
          weeklyReports: true
        },
        theme: 'light' as const,
        language: 'es',
        workingHours: {
          start: '10:00',
          end: '19:00'
        }
      };

      mockUserRepository.update.mockResolvedValue(mockUser);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      const result = await userProfileService.updatePreferences('user-123', preferences);

      expect(result).toEqual(mockPublicUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        preferences
      });
    });

    it('should use default values for missing preference fields', async () => {
      const partialPreferences = {
        theme: 'dark' as const
      };

      const expectedPreferences = userPreferencesSchema.parse(partialPreferences);

      mockUserRepository.update.mockResolvedValue(mockUser);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      await userProfileService.updatePreferences('user-123', partialPreferences as any);

      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        preferences: expectedPreferences
      });
    });
  });

  describe('getUnlockedItems', () => {
    it('should return unlocked items', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userProfileService.getUnlockedItems('user-123');

      expect(result).toEqual(['warrior', 'sword', 'shield', 'mage-hat']);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should return empty array if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await userProfileService.getUnlockedItems('nonexistent');

      expect(result).toEqual([]);
    });

    it('should return empty array if user has no unlocked items', async () => {
      const userWithoutItems = { ...mockUser, unlockedItems: null };
      mockUserRepository.findById.mockResolvedValue(userWithoutItems);

      const result = await userProfileService.getUnlockedItems('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('addUnlockedItems', () => {
    it('should add new unlocked items', async () => {
      const newItems = ['dragon-armor', 'fire-sword'];
      const expectedItems = ['warrior', 'sword', 'shield', 'mage-hat', 'dragon-armor', 'fire-sword'];

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(mockUser);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      const result = await userProfileService.addUnlockedItems('user-123', newItems);

      expect(result).toEqual(mockPublicUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        unlockedItems: expectedItems
      });
    });

    it('should avoid duplicate items', async () => {
      const duplicateItems = ['sword', 'new-item'];
      const expectedItems = ['warrior', 'sword', 'shield', 'mage-hat', 'new-item'];

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(mockUser);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      await userProfileService.addUnlockedItems('user-123', duplicateItems);

      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        unlockedItems: expectedItems
      });
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await userProfileService.addUnlockedItems('nonexistent', ['item']);

      expect(result).toBeNull();
    });
  });

  describe('getProfileStats', () => {
    it('should return profile statistics', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userProfileService.getProfileStats('user-123');

      expect(result).toEqual({
        level: 5,
        totalXP: 1250,
        currentLevelXP: 250,
        nextLevelXP: 500,
        progressToNextLevel: 50, // 250/500 * 100
        unlockedItemsCount: 4
      });
    });

    it('should handle 100% progress correctly', async () => {
      const userAtMaxLevel = { ...mockUser, currentLevelXP: 500, nextLevelXP: 500 };
      mockUserRepository.findById.mockResolvedValue(userAtMaxLevel);

      const result = await userProfileService.getProfileStats('user-123');

      expect(result?.progressToNextLevel).toBe(100);
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await userProfileService.getProfileStats('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validateAvatarItems', () => {
    it('should validate that all items are unlocked', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userProfileService.validateAvatarItems('user-123', ['warrior', 'sword']);

      expect(result).toEqual({
        valid: true,
        invalidItems: []
      });
    });

    it('should identify invalid items', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userProfileService.validateAvatarItems('user-123', ['warrior', 'locked-item']);

      expect(result).toEqual({
        valid: false,
        invalidItems: ['locked-item']
      });
    });
  });

  describe('resetAvatar', () => {
    it('should reset avatar to default configuration', async () => {
      mockUserRepository.update.mockResolvedValue(mockUser);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      const result = await userProfileService.resetAvatar('user-123');

      expect(result).toEqual(mockPublicUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        avatarConfig: {
          baseAvatar: 'default',
          accessories: [],
          colors: {}
        }
      });
    });
  });

  describe('getDefaultPreferences', () => {
    it('should return default preferences', () => {
      const result = userProfileService.getDefaultPreferences();

      expect(result).toEqual({
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
      });
    });
  });

  describe('Schema validation', () => {
    it('should validate updateProfileSchema correctly', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        timezone: 'America/New_York'
      };

      expect(() => updateProfileSchema.parse(validData)).not.toThrow();

      const invalidData = {
        firstName: '', // Empty string should fail
        lastName: 'Doe'
      };

      expect(() => updateProfileSchema.parse(invalidData)).toThrow();
    });

    it('should validate avatarCustomizationSchema correctly', () => {
      const validConfig = {
        baseAvatar: 'warrior',
        accessories: ['sword', 'shield'],
        colors: { primary: '#ff0000' }
      };

      expect(() => avatarCustomizationSchema.parse(validConfig)).not.toThrow();

      const invalidConfig = {
        baseAvatar: '', // Empty string should fail
        accessories: ['sword']
      };

      expect(() => avatarCustomizationSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate userPreferencesSchema correctly', () => {
      const validPreferences = {
        notifications: {
          taskReminders: true,
          habitReminders: false,
          achievements: true,
          weeklyReports: true
        },
        theme: 'dark',
        language: 'en',
        workingHours: {
          start: '09:00',
          end: '17:00'
        }
      };

      expect(() => userPreferencesSchema.parse(validPreferences)).not.toThrow();

      const invalidPreferences = {
        theme: 'invalid-theme' // Should fail enum validation
      };

      expect(() => userPreferencesSchema.parse(invalidPreferences)).toThrow();
    });
  });
});