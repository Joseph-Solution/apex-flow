import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AchievementService, AchievementContext } from '../services/AchievementService';
import { AchievementRepository } from '../repositories/AchievementRepository';
import { UserRepository } from '../repositories/UserRepository';
import { ExperienceService } from '../services/ExperienceService';
import { UserProfileService } from '../services/UserProfileService';
import { Achievement, UserAchievement, AchievementProgress } from '../db/schema/achievements';

// Mock all dependencies
jest.mock('../repositories/AchievementRepository');
jest.mock('../repositories/UserRepository');
jest.mock('../services/ExperienceService');
jest.mock('../services/UserProfileService');

describe('AchievementService', () => {
  let achievementService: AchievementService;
  let mockAchievementRepository: jest.Mocked<AchievementRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockExperienceService: jest.Mocked<ExperienceService>;
  let mockUserProfileService: jest.Mocked<UserProfileService>;

  const mockAchievement: Achievement = {
    id: 'achievement-123',
    name: 'First Steps',
    description: 'Complete your first task',
    icon: '✅',
    category: 'tasks',
    rarity: 'common',
    xpReward: 25,
    criteria: {
      type: 'task_count',
      target: 1,
    },
    unlockedItems: ['task-badge-bronze'],
    badgeColor: '#FFD700',
    isActive: true,
    isSecret: false,
    sortOrder: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockUserAchievement: UserAchievement & { achievement: Achievement } = {
    id: 'user-achievement-123',
    userId: 'user-123',
    achievementId: 'achievement-123',
    unlockedAt: new Date('2024-01-15'),
    progress: 1,
    isCompleted: true,
    unlockedValue: 1,
    notes: 'First task completed',
    createdAt: new Date('2024-01-15'),
    achievement: mockAchievement,
  };

  const mockAchievementProgress: AchievementProgress & { achievement: Achievement } = {
    id: 'progress-123',
    userId: 'user-123',
    achievementId: 'achievement-123',
    currentProgress: 5,
    targetProgress: 10,
    progressPercentage: 50,
    lastUpdated: new Date('2024-01-15'),
    progressData: { lastActivity: 'task' },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    achievement: mockAchievement,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAchievementRepository = new AchievementRepository() as jest.Mocked<AchievementRepository>;
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    mockExperienceService = new ExperienceService() as jest.Mocked<ExperienceService>;
    mockUserProfileService = new UserProfileService() as jest.Mocked<UserProfileService>;

    achievementService = new AchievementService();
    
    // Replace the repository instances
    (achievementService as any).achievementRepository = mockAchievementRepository;
    (achievementService as any).userRepository = mockUserRepository;
    (achievementService as any).experienceService = mockExperienceService;
    (achievementService as any).userProfileService = mockUserProfileService;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic CRUD Operations', () => {
    it('should create a new achievement', async () => {
      const newAchievement = {
        name: 'Test Achievement',
        description: 'Test description',
        category: 'tasks' as const,
        criteria: { type: 'task_count' as const, target: 5 },
      };

      mockAchievementRepository.createAchievement.mockResolvedValue(mockAchievement);

      const result = await achievementService.createAchievement(newAchievement);

      expect(result).toEqual(mockAchievement);
      expect(mockAchievementRepository.createAchievement).toHaveBeenCalledWith(newAchievement);
    });

    it('should get all achievements', async () => {
      mockAchievementRepository.getAllAchievements.mockResolvedValue([mockAchievement]);

      const result = await achievementService.getAllAchievements();

      expect(result).toEqual([mockAchievement]);
      expect(mockAchievementRepository.getAllAchievements).toHaveBeenCalledWith(false);
    });

    it('should get achievement by ID', async () => {
      mockAchievementRepository.getAchievementById.mockResolvedValue(mockAchievement);

      const result = await achievementService.getAchievementById('achievement-123');

      expect(result).toEqual(mockAchievement);
      expect(mockAchievementRepository.getAchievementById).toHaveBeenCalledWith('achievement-123');
    });
  });

  describe('User Achievement Operations', () => {
    it('should get user achievements', async () => {
      mockAchievementRepository.getUserAchievements.mockResolvedValue([mockUserAchievement]);

      const result = await achievementService.getUserAchievements('user-123');

      expect(result).toEqual([mockUserAchievement]);
      expect(mockAchievementRepository.getUserAchievements).toHaveBeenCalledWith('user-123');
    });

    it('should get user achievement progress', async () => {
      mockAchievementRepository.getUserAchievementProgress.mockResolvedValue([mockAchievementProgress]);

      const result = await achievementService.getUserAchievementProgress('user-123');

      expect(result).toEqual([mockAchievementProgress]);
      expect(mockAchievementRepository.getUserAchievementProgress).toHaveBeenCalledWith('user-123');
    });

    it('should get user achievement stats', async () => {
      const mockStats = {
        totalAchievements: 10,
        unlockedAchievements: 3,
        completionRate: 30,
        totalXPFromAchievements: 150,
        rareAchievements: 1,
        epicAchievements: 0,
        legendaryAchievements: 0,
        recentUnlocks: [
          {
            achievementId: 'achievement-123',
            name: 'First Steps',
            unlockedAt: '2024-01-15T00:00:00.000Z',
          },
        ],
      };

      mockAchievementRepository.getUserAchievementStats.mockResolvedValue(mockStats);

      const result = await achievementService.getUserAchievementStats('user-123');

      expect(result).toEqual(mockStats);
      expect(mockAchievementRepository.getUserAchievementStats).toHaveBeenCalledWith('user-123');
    });
  });

  describe('Achievement Unlocking', () => {
    it('should unlock achievement successfully', async () => {
      mockAchievementRepository.hasUserUnlockedAchievement.mockResolvedValue(false);
      mockAchievementRepository.getAchievementById.mockResolvedValue(mockAchievement);
      mockAchievementRepository.unlockAchievement.mockResolvedValue(mockUserAchievement);
      mockExperienceService.awardXP.mockResolvedValue({
        xpAwarded: 25,
        previousLevel: 1,
        newLevel: 1,
        leveledUp: false,
        newLevelInfo: {
          level: 1,
          currentXP: 25,
          nextLevelXP: 100,
          totalXP: 25,
          progressToNext: 25,
          isMaxLevel: false,
        },
      });
      mockUserProfileService.addUnlockedItems.mockResolvedValue({} as any);

      const result = await achievementService.unlockAchievement('user-123', 'achievement-123');

      expect(result).toBeTruthy();
      expect(result!.achievement).toEqual(mockAchievement);
      expect(result!.xpAwarded).toBe(25);
      expect(result!.unlockedItems).toEqual(['task-badge-bronze']);
      expect(result!.isNewUnlock).toBe(true);

      expect(mockAchievementRepository.unlockAchievement).toHaveBeenCalledWith(
        'user-123',
        'achievement-123',
        0,
        undefined
      );
      expect(mockExperienceService.awardXP).toHaveBeenCalledWith('user-123', {
        type: 'achievement',
        amount: 25,
        reason: 'Unlocked achievement: First Steps',
        metadata: { achievementId: 'achievement-123', category: 'tasks' },
      });
      expect(mockUserProfileService.addUnlockedItems).toHaveBeenCalledWith('user-123', ['task-badge-bronze']);
    });

    it('should return null if achievement already unlocked', async () => {
      mockAchievementRepository.hasUserUnlockedAchievement.mockResolvedValue(true);

      const result = await achievementService.unlockAchievement('user-123', 'achievement-123');

      expect(result).toBeNull();
      expect(mockAchievementRepository.unlockAchievement).not.toHaveBeenCalled();
    });

    it('should return null if achievement not found', async () => {
      mockAchievementRepository.hasUserUnlockedAchievement.mockResolvedValue(false);
      mockAchievementRepository.getAchievementById.mockResolvedValue(null);

      const result = await achievementService.unlockAchievement('user-123', 'nonexistent');

      expect(result).toBeNull();
      expect(mockAchievementRepository.unlockAchievement).not.toHaveBeenCalled();
    });
  });

  describe('Achievement Criteria Evaluation', () => {
    it('should check and unlock achievements based on task completion', async () => {
      const context: AchievementContext = {
        userId: 'user-123',
        activityType: 'task',
        activityData: { taskId: 'task-123', priority: 'high' },
        userStats: {
          level: 2,
          totalXP: 150,
          tasksCompleted: 1,
        },
      };

      mockAchievementRepository.getAvailableAchievements.mockResolvedValue([mockAchievement]);
      mockAchievementRepository.hasUserUnlockedAchievement.mockResolvedValue(false);
      mockAchievementRepository.getAchievementById.mockResolvedValue(mockAchievement);
      mockAchievementRepository.unlockAchievement.mockResolvedValue(mockUserAchievement);
      mockExperienceService.awardXP.mockResolvedValue({
        xpAwarded: 25,
        previousLevel: 2,
        newLevel: 2,
        leveledUp: false,
        newLevelInfo: {
          level: 2,
          currentXP: 75,
          nextLevelXP: 120,
          totalXP: 175,
          progressToNext: 62,
          isMaxLevel: false,
        },
      });
      mockUserProfileService.addUnlockedItems.mockResolvedValue({} as any);

      const results = await achievementService.checkAndUnlockAchievements(context);

      expect(results).toHaveLength(1);
      expect(results[0].achievement).toEqual(mockAchievement);
      expect(results[0].isNewUnlock).toBe(true);
    });

    it('should update progress if achievement not unlocked', async () => {
      const incompleteAchievement = {
        ...mockAchievement,
        criteria: { type: 'task_count' as const, target: 10 }, // Higher target
      };

      const context: AchievementContext = {
        userId: 'user-123',
        activityType: 'task',
        activityData: { taskId: 'task-123' },
        userStats: {
          level: 1,
          totalXP: 50,
          tasksCompleted: 5, // Not enough to unlock
        },
      };

      mockAchievementRepository.getAvailableAchievements.mockResolvedValue([incompleteAchievement]);
      mockAchievementRepository.updateAchievementProgress.mockResolvedValue(mockAchievementProgress);

      const results = await achievementService.checkAndUnlockAchievements(context);

      expect(results).toHaveLength(0); // No unlocks
      expect(mockAchievementRepository.updateAchievementProgress).toHaveBeenCalledWith(
        'user-123',
        'achievement-123',
        5, // Current progress
        10, // Target progress
        expect.objectContaining({
          lastActivity: 'task',
        })
      );
    });
  });

  describe('Achievement Categories and Filtering', () => {
    it('should get achievements by category', async () => {
      mockAchievementRepository.getAchievementsByCategory.mockResolvedValue([mockAchievement]);

      const result = await achievementService.getAchievementsByCategory('tasks');

      expect(result).toEqual([mockAchievement]);
      expect(mockAchievementRepository.getAchievementsByCategory).toHaveBeenCalledWith('tasks');
    });

    it('should get achievements by rarity', async () => {
      mockAchievementRepository.getAchievementsByRarity.mockResolvedValue([mockAchievement]);

      const result = await achievementService.getAchievementsByRarity('common');

      expect(result).toEqual([mockAchievement]);
      expect(mockAchievementRepository.getAchievementsByRarity).toHaveBeenCalledWith('common');
    });

    it('should get available achievements for user', async () => {
      mockAchievementRepository.getAvailableAchievements.mockResolvedValue([mockAchievement]);

      const result = await achievementService.getAvailableAchievements('user-123');

      expect(result).toEqual([mockAchievement]);
      expect(mockAchievementRepository.getAvailableAchievements).toHaveBeenCalledWith('user-123', false);
    });
  });

  describe('Achievement Progress Tracking', () => {
    it('should get achievement progress for user', async () => {
      mockAchievementRepository.getAchievementProgress.mockResolvedValue(mockAchievementProgress);

      const result = await achievementService.getAchievementProgress('user-123', 'achievement-123');

      expect(result).toEqual(mockAchievementProgress);
      expect(mockAchievementRepository.getAchievementProgress).toHaveBeenCalledWith('user-123', 'achievement-123');
    });

    it('should get user completion rate', async () => {
      const mockStats = {
        totalAchievements: 10,
        unlockedAchievements: 3,
        completionRate: 30,
        totalXPFromAchievements: 150,
        rareAchievements: 1,
        epicAchievements: 0,
        legendaryAchievements: 0,
        recentUnlocks: [],
      };

      mockAchievementRepository.getUserAchievementStats.mockResolvedValue(mockStats);

      const result = await achievementService.getUserCompletionRate('user-123');

      expect(result).toBe(30);
    });

    it('should get recent unlocks', async () => {
      const mockStats = {
        totalAchievements: 10,
        unlockedAchievements: 3,
        completionRate: 30,
        totalXPFromAchievements: 150,
        rareAchievements: 1,
        epicAchievements: 0,
        legendaryAchievements: 0,
        recentUnlocks: [
          {
            achievementId: 'achievement-123',
            name: 'First Steps',
            unlockedAt: '2024-01-15T00:00:00.000Z',
          },
          {
            achievementId: 'achievement-456',
            name: 'Second Achievement',
            unlockedAt: '2024-01-14T00:00:00.000Z',
          },
        ],
      };

      mockAchievementRepository.getUserAchievementStats.mockResolvedValue(mockStats);

      const result = await achievementService.getRecentUnlocks('user-123', 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        achievementId: 'achievement-123',
        name: 'First Steps',
        unlockedAt: '2024-01-15T00:00:00.000Z',
      });
    });
  });

  describe('Default Achievement Seeding', () => {
    it('should seed default achievements', async () => {
      const mockSeededAchievements = [mockAchievement];
      mockAchievementRepository.bulkCreateAchievements.mockResolvedValue(mockSeededAchievements);

      const result = await achievementService.seedDefaultAchievements();

      expect(result).toEqual(mockSeededAchievements);
      expect(mockAchievementRepository.bulkCreateAchievements).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'First Steps',
            category: 'tasks',
          }),
          expect.objectContaining({
            name: 'Task Master',
            category: 'tasks',
          }),
          expect.objectContaining({
            name: 'Habit Starter',
            category: 'habits',
          }),
        ])
      );
    });
  });

  describe('Force Unlock (Admin Function)', () => {
    it('should force unlock achievement', async () => {
      mockAchievementRepository.hasUserUnlockedAchievement.mockResolvedValue(false);
      mockAchievementRepository.getAchievementById.mockResolvedValue(mockAchievement);
      mockAchievementRepository.unlockAchievement.mockResolvedValue(mockUserAchievement);
      mockExperienceService.awardXP.mockResolvedValue({
        xpAwarded: 25,
        previousLevel: 1,
        newLevel: 1,
        leveledUp: false,
        newLevelInfo: {
          level: 1,
          currentXP: 25,
          nextLevelXP: 100,
          totalXP: 25,
          progressToNext: 25,
          isMaxLevel: false,
        },
      });
      mockUserProfileService.addUnlockedItems.mockResolvedValue({} as any);

      const result = await achievementService.forceUnlockAchievement('user-123', 'achievement-123', 'Admin unlock');

      expect(result).toBeTruthy();
      expect(result!.achievement).toEqual(mockAchievement);
      expect(result!.isNewUnlock).toBe(true);
    });
  });

  describe('Criteria Evaluation Edge Cases', () => {
    it('should handle level reached criteria', async () => {
      const levelAchievement = {
        ...mockAchievement,
        criteria: { type: 'level_reached' as const, target: 5 },
      };

      const context: AchievementContext = {
        userId: 'user-123',
        activityType: 'level',
        activityData: {},
        userStats: { level: 5, totalXP: 500 },
      };

      mockAchievementRepository.getAvailableAchievements.mockResolvedValue([levelAchievement]);
      mockAchievementRepository.hasUserUnlockedAchievement.mockResolvedValue(false);
      mockAchievementRepository.getAchievementById.mockResolvedValue(levelAchievement);
      mockAchievementRepository.unlockAchievement.mockResolvedValue(mockUserAchievement);
      mockExperienceService.awardXP.mockResolvedValue({
        xpAwarded: 25,
        previousLevel: 5,
        newLevel: 5,
        leveledUp: false,
        newLevelInfo: {
          level: 5,
          currentXP: 25,
          nextLevelXP: 200,
          totalXP: 525,
          progressToNext: 12,
          isMaxLevel: false,
        },
      });
      mockUserProfileService.addUnlockedItems.mockResolvedValue({} as any);

      const results = await achievementService.checkAndUnlockAchievements(context);

      expect(results).toHaveLength(1);
      expect(results[0].achievement.criteria.type).toBe('level_reached');
    });

    it('should handle habit streak criteria', async () => {
      const streakAchievement = {
        ...mockAchievement,
        criteria: { type: 'habit_streak' as const, target: 7 },
      };

      const context: AchievementContext = {
        userId: 'user-123',
        activityType: 'habit',
        activityData: { currentStreak: 7 },
        userStats: { level: 2, totalXP: 150 },
      };

      mockAchievementRepository.getAvailableAchievements.mockResolvedValue([streakAchievement]);
      mockAchievementRepository.hasUserUnlockedAchievement.mockResolvedValue(false);
      mockAchievementRepository.getAchievementById.mockResolvedValue(streakAchievement);
      mockAchievementRepository.unlockAchievement.mockResolvedValue(mockUserAchievement);
      mockExperienceService.awardXP.mockResolvedValue({
        xpAwarded: 25,
        previousLevel: 2,
        newLevel: 2,
        leveledUp: false,
        newLevelInfo: {
          level: 2,
          currentXP: 75,
          nextLevelXP: 120,
          totalXP: 175,
          progressToNext: 62,
          isMaxLevel: false,
        },
      });
      mockUserProfileService.addUnlockedItems.mockResolvedValue({} as any);

      const results = await achievementService.checkAndUnlockAchievements(context);

      expect(results).toHaveLength(1);
      expect(results[0].achievement.criteria.type).toBe('habit_streak');
    });
  });
});