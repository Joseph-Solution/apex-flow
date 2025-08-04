import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import profileRoutes from '../routes/profile';
import { UserProfileService } from '../services/UserProfileService';
import { PublicUser } from '../db/schema/users';

// Mock the UserProfileService
jest.mock('../services/UserProfileService');

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'user-123' };
    next();
  }
}));

describe('Profile Routes', () => {
  let app: express.Application;
  let mockUserProfileService: jest.Mocked<UserProfileService>;

  const mockPublicUser: PublicUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'John',
    lastName: 'Doe',
    timezone: 'UTC',
    level: 5,
    totalXP: 1250,
    currentLevelXP: 250,
    nextLevelXP: 500,
    avatarConfig: {
      baseAvatar: 'warrior',
      accessories: ['sword'],
      colors: { primary: '#ff0000' }
    },
    unlockedItems: ['warrior', 'sword', 'shield'],
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
        start: '09:00',
        end: '17:00'
      }
    },
    isActive: true,
    emailVerified: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    lastLoginAt: new Date('2024-01-15')
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.use('/api/profile', profileRoutes);

    // Mock the service instance
    mockUserProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      updatePreferences: jest.fn(),
      getUnlockedItems: jest.fn(),
      addUnlockedItems: jest.fn(),
      getProfileStats: jest.fn(),
      validateAvatarItems: jest.fn(),
      resetAvatar: jest.fn(),
      getDefaultPreferences: jest.fn()
    } as any;

    // Replace the service constructor
    (UserProfileService as jest.MockedClass<typeof UserProfileService>).mockImplementation(() => mockUserProfileService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/profile', () => {
    it('should return user profile successfully', async () => {
      mockUserProfileService.getProfile.mockResolvedValue(mockPublicUser);

      const response = await request(app)
        .get('/api/profile')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPublicUser
      });
      expect(mockUserProfileService.getProfile).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 if profile not found', async () => {
      mockUserProfileService.getProfile.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/profile')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROFILE_NOT_FOUND');
    });

    it('should handle service errors', async () => {
      mockUserProfileService.getProfile.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/profile')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/profile', () => {
    it('should update profile successfully', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        timezone: 'America/New_York'
      };

      mockUserProfileService.updateProfile.mockResolvedValue(mockPublicUser);

      const response = await request(app)
        .put('/api/profile')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPublicUser,
        message: 'Profile updated successfully'
      });
      expect(mockUserProfileService.updateProfile).toHaveBeenCalledWith('user-123', updateData);
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        firstName: '', // Empty string should fail validation
        lastName: 'Smith'
      };

      const response = await request(app)
        .put('/api/profile')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if profile not found', async () => {
      const updateData = { firstName: 'Jane' };
      mockUserProfileService.updateProfile.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/profile')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROFILE_NOT_FOUND');
    });
  });

  describe('GET /api/profile/stats', () => {
    it('should return profile statistics', async () => {
      const mockStats = {
        level: 5,
        totalXP: 1250,
        currentLevelXP: 250,
        nextLevelXP: 500,
        progressToNextLevel: 50,
        unlockedItemsCount: 3
      };

      mockUserProfileService.getProfileStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/profile/stats')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStats
      });
      expect(mockUserProfileService.getProfileStats).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 if profile not found', async () => {
      mockUserProfileService.getProfileStats.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/profile/stats')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROFILE_NOT_FOUND');
    });
  });

  describe('PUT /api/profile/avatar', () => {
    it('should update avatar successfully', async () => {
      const avatarConfig = {
        baseAvatar: 'mage',
        accessories: ['staff'],
        colors: { primary: '#0000ff' }
      };

      mockUserProfileService.validateAvatarItems.mockResolvedValue({
        valid: true,
        invalidItems: []
      });
      mockUserProfileService.updateAvatar.mockResolvedValue(mockPublicUser);

      const response = await request(app)
        .put('/api/profile/avatar')
        .send(avatarConfig)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPublicUser,
        message: 'Avatar updated successfully'
      });
      expect(mockUserProfileService.validateAvatarItems).toHaveBeenCalledWith(
        'user-123',
        ['mage', 'staff']
      );
      expect(mockUserProfileService.updateAvatar).toHaveBeenCalledWith('user-123', avatarConfig);
    });

    it('should return 403 if avatar items are locked', async () => {
      const avatarConfig = {
        baseAvatar: 'locked-avatar',
        accessories: ['locked-item'],
        colors: {}
      };

      mockUserProfileService.validateAvatarItems.mockResolvedValue({
        valid: false,
        invalidItems: ['locked-avatar', 'locked-item']
      });

      const response = await request(app)
        .put('/api/profile/avatar')
        .send(avatarConfig)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AVATAR_ITEMS_LOCKED');
      expect(response.body.error.details.invalidItems).toEqual(['locked-avatar', 'locked-item']);
    });

    it('should return validation error for invalid avatar config', async () => {
      const invalidConfig = {
        baseAvatar: '', // Empty string should fail
        accessories: ['staff']
      };

      const response = await request(app)
        .put('/api/profile/avatar')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/profile/avatar/reset', () => {
    it('should reset avatar successfully', async () => {
      mockUserProfileService.resetAvatar.mockResolvedValue(mockPublicUser);

      const response = await request(app)
        .post('/api/profile/avatar/reset')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPublicUser,
        message: 'Avatar reset to default successfully'
      });
      expect(mockUserProfileService.resetAvatar).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 if profile not found', async () => {
      mockUserProfileService.resetAvatar.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/profile/avatar/reset')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROFILE_NOT_FOUND');
    });
  });

  describe('PUT /api/profile/preferences', () => {
    it('should update preferences successfully', async () => {
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

      mockUserProfileService.updatePreferences.mockResolvedValue(mockPublicUser);

      const response = await request(app)
        .put('/api/profile/preferences')
        .send(preferences)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPublicUser,
        message: 'Preferences updated successfully'
      });
      expect(mockUserProfileService.updatePreferences).toHaveBeenCalledWith('user-123', preferences);
    });

    it('should return validation error for invalid preferences', async () => {
      const invalidPreferences = {
        theme: 'invalid-theme' // Should fail enum validation
      };

      const response = await request(app)
        .put('/api/profile/preferences')
        .send(invalidPreferences)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/profile/unlocked-items', () => {
    it('should return unlocked items', async () => {
      const unlockedItems = ['warrior', 'sword', 'shield', 'mage-hat'];
      mockUserProfileService.getUnlockedItems.mockResolvedValue(unlockedItems);

      const response = await request(app)
        .get('/api/profile/unlocked-items')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { unlockedItems }
      });
      expect(mockUserProfileService.getUnlockedItems).toHaveBeenCalledWith('user-123');
    });

    it('should handle service errors', async () => {
      mockUserProfileService.getUnlockedItems.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/profile/unlocked-items')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});