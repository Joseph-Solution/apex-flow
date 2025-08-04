import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ExperienceService, XPConfig } from '../services/ExperienceService';
import { UserRepository } from '../repositories/UserRepository';
import { User } from '../db/schema/users';

// Mock the UserRepository
jest.mock('../repositories/UserRepository');

describe('ExperienceService', () => {
  let experienceService: ExperienceService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    timezone: 'UTC',
    level: 3,
    totalXP: 250,
    currentLevelXP: 50,
    nextLevelXP: 144, // Based on default config
    avatarConfig: {
      baseAvatar: 'default',
      accessories: [],
      colors: {}
    },
    unlockedItems: ['bronze-badge'],
    preferences: {
      notifications: {
        taskReminders: true,
        habitReminders: true,
        achievements: true,
        weeklyReports: true
      },
      theme: 'auto' as const,
      language: 'en',
      workingHours: {
        start: '09:00',
        end: '17:00'
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    experienceService = new ExperienceService();
    // Replace the repository instance
    (experienceService as any).userRepository = mockUserRepository;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('XP Calculations', () => {
    it('should calculate XP requirement for specific levels', () => {
      expect(experienceService.calculateXPRequirement(1)).toBe(0);
      expect(experienceService.calculateXPRequirement(2)).toBe(100); // Base requirement
      expect(experienceService.calculateXPRequirement(3)).toBe(120); // 100 * 1.2
      expect(experienceService.calculateXPRequirement(4)).toBe(144); // 100 * 1.2^2
    });

    it('should calculate total XP needed for a level', () => {
      expect(experienceService.calculateTotalXPForLevel(1)).toBe(0);
      expect(experienceService.calculateTotalXPForLevel(2)).toBe(100);
      expect(experienceService.calculateTotalXPForLevel(3)).toBe(220); // 100 + 120
      expect(experienceService.calculateTotalXPForLevel(4)).toBe(364); // 100 + 120 + 144
    });

    it('should calculate level from total XP', () => {
      const levelInfo = experienceService.calculateLevelFromXP(250);
      
      expect(levelInfo.level).toBe(3);
      expect(levelInfo.currentXP).toBe(30); // 250 - 220 (total XP for level 3)
      expect(levelInfo.nextLevelXP).toBe(144);
      expect(levelInfo.totalXP).toBe(250);
      expect(levelInfo.progressToNext).toBe(21); // 30/144 * 100 rounded
      expect(levelInfo.isMaxLevel).toBe(false);
    });

    it('should handle max level correctly', () => {
      const customConfig = { levelingXP: { max_level: 5, base_requirement: 100, growth_factor: 1.2 } };
      const service = new ExperienceService(customConfig);
      
      const levelInfo = service.calculateLevelFromXP(10000); // Very high XP
      
      expect(levelInfo.level).toBe(5);
      expect(levelInfo.isMaxLevel).toBe(true);
      expect(levelInfo.nextLevelXP).toBe(0);
      expect(levelInfo.progressToNext).toBe(100);
    });
  });

  describe('Task XP Calculations', () => {
    it('should calculate correct XP for different task priorities', () => {
      expect(experienceService.calculateTaskXP('low')).toBe(10);
      expect(experienceService.calculateTaskXP('medium')).toBe(20);
      expect(experienceService.calculateTaskXP('high')).toBe(35);
      expect(experienceService.calculateTaskXP('urgent')).toBe(50);
    });

    it('should apply overdue penalty', () => {
      const xp = experienceService.calculateTaskXP('medium', { isOverdue: true });
      expect(xp).toBe(16); // 20 * 0.8
    });

    it('should apply early completion bonus', () => {
      const xp = experienceService.calculateTaskXP('medium', { completedEarly: true });
      expect(xp).toBe(24); // 20 * 1.2
    });

    it('should ensure minimum XP of 1', () => {
      const customConfig = { taskXP: { low: 1, medium: 1, high: 1, urgent: 1 } };
      const service = new ExperienceService(customConfig);
      
      const xp = service.calculateTaskXP('low', { isOverdue: true });
      expect(xp).toBe(1); // Should not go below 1
    });
  });

  describe('Habit XP Calculations', () => {
    it('should calculate correct XP for different habit frequencies', () => {
      expect(experienceService.calculateHabitXP('daily')).toBe(15);
      expect(experienceService.calculateHabitXP('weekly')).toBe(25);
    });

    it('should apply streak bonuses', () => {
      expect(experienceService.calculateHabitXP('daily', 7)).toBe(20); // 15 + 5 (1 milestone)
      expect(experienceService.calculateHabitXP('daily', 14)).toBe(25); // 15 + 10 (2 milestones)
      expect(experienceService.calculateHabitXP('daily', 6)).toBe(15); // No milestone yet
    });
  });

  describe('Goal XP Calculations', () => {
    it('should calculate milestone XP', () => {
      expect(experienceService.calculateGoalMilestoneXP()).toBe(30);
    });

    it('should apply early completion bonus to milestones', () => {
      const xp = experienceService.calculateGoalMilestoneXP({ completedEarly: true });
      expect(xp).toBe(45); // 30 * 1.5
    });

    it('should calculate goal completion XP', () => {
      expect(experienceService.calculateGoalCompletionXP(1)).toBe(100);
      expect(experienceService.calculateGoalCompletionXP(4)).toBe(200); // 100 * sqrt(4)
    });

    it('should apply early completion bonus to goals', () => {
      const xp = experienceService.calculateGoalCompletionXP(1, { completedEarly: true });
      expect(xp).toBe(150); // 100 * 1.5
    });
  });

  describe('XP Awarding', () => {
    it('should award XP and update user level', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({ ...mockUser, totalXP: 300, level: 3 });

      const result = await experienceService.awardXP('user-123', {
        type: 'task',
        amount: 50,
        reason: 'Completed task',
      });

      expect(result).toBeTruthy();
      expect(result!.xpAwarded).toBe(50);
      expect(result!.previousLevel).toBe(3);
      expect(result!.leveledUp).toBe(false);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', expect.objectContaining({
        totalXP: 300,
      }));
    });

    it('should detect level up and unlock rewards', async () => {
      // User at level 4 with 450 XP, adding 100 XP should level up to 5 and unlock rewards
      // Level 5 requires: 100 + 120 + 144 + 173 = 537 total XP
      const userNearLevelUp = { ...mockUser, level: 4, totalXP: 450, currentLevelXP: 86, nextLevelXP: 173 };
      mockUserRepository.findById.mockResolvedValue(userNearLevelUp);
      mockUserRepository.update.mockResolvedValueOnce({ ...userNearLevelUp, totalXP: 550, level: 5 });
      mockUserRepository.update.mockResolvedValueOnce({ ...userNearLevelUp, totalXP: 550, level: 5 });

      const result = await experienceService.awardXP('user-123', {
        type: 'task',
        amount: 100, // Enough to level up to 5
        reason: 'Completed task',
      });

      expect(result).toBeTruthy();
      expect(result!.leveledUp).toBe(true);
      expect(result!.previousLevel).toBe(4);
      expect(result!.newLevel).toBe(5);
      expect(result!.unlockedRewards).toEqual(['warrior-avatar', 'basic-sword']);
      expect(mockUserRepository.update).toHaveBeenCalledTimes(2); // Once for XP, once for unlocked items
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await experienceService.awardXP('nonexistent', {
        type: 'task',
        amount: 50,
        reason: 'Completed task',
      });

      expect(result).toBeNull();
    });
  });

  describe('Specific XP Award Methods', () => {
    beforeEach(() => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({ ...mockUser, totalXP: 300 });
    });

    it('should award task XP', async () => {
      const result = await experienceService.awardTaskXP('user-123', 'high', 'Important task');

      expect(result).toBeTruthy();
      expect(result!.xpAwarded).toBe(35);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', expect.objectContaining({
        totalXP: 285, // 250 + 35
      }));
    });

    it('should award habit XP with streak bonus', async () => {
      const result = await experienceService.awardHabitXP('user-123', 'daily', 'Exercise', 14);

      expect(result).toBeTruthy();
      expect(result!.xpAwarded).toBe(25); // 15 + 10 (2 streak bonuses)
    });

    it('should award goal milestone XP', async () => {
      const result = await experienceService.awardGoalMilestoneXP('user-123', 'First milestone');

      expect(result).toBeTruthy();
      expect(result!.xpAwarded).toBe(30);
    });

    it('should award goal completion XP', async () => {
      const result = await experienceService.awardGoalCompletionXP('user-123', 'Big goal', 3);

      expect(result).toBeTruthy();
      expect(result!.xpAwarded).toBe(173); // 100 * sqrt(3) = ~173
    });
  });

  describe('Level Rewards', () => {
    it('should return correct rewards for specific levels', () => {
      expect(experienceService.getLevelUpRewards(2)).toEqual(['bronze-badge']);
      expect(experienceService.getLevelUpRewards(5)).toEqual(['warrior-avatar', 'basic-sword']);
      expect(experienceService.getLevelUpRewards(10)).toEqual(['silver-badge', 'shield']);
      expect(experienceService.getLevelUpRewards(3)).toEqual([]); // No rewards for level 3
    });
  });

  describe('User Level Info', () => {
    it('should get user level info', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const levelInfo = await experienceService.getUserLevelInfo('user-123');

      expect(levelInfo).toBeTruthy();
      expect(levelInfo!.level).toBe(3);
      expect(levelInfo!.totalXP).toBe(250);
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const levelInfo = await experienceService.getUserLevelInfo('nonexistent');

      expect(levelInfo).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customConfig = {
        taskXP: { low: 5, medium: 10, high: 20, urgent: 30 }
      };
      const service = new ExperienceService(customConfig);

      expect(service.calculateTaskXP('low')).toBe(5);
      expect(service.calculateTaskXP('urgent')).toBe(30);
    });

    it('should get and update XP configuration', () => {
      const config = experienceService.getXPConfig();
      expect(config.taskXP.low).toBe(10);

      experienceService.updateXPConfig({
        taskXP: { low: 15, medium: 25, high: 40, urgent: 60 }
      });

      const updatedConfig = experienceService.getXPConfig();
      expect(updatedConfig.taskXP.low).toBe(15);
    });
  });

  describe('Progression Simulation', () => {
    it('should simulate XP progression correctly', () => {
      const simulation = experienceService.simulateProgression(100, 150); // From level 2 to level 3

      expect(simulation.startLevel.level).toBe(2);
      expect(simulation.endLevel.level).toBe(3);
      expect(simulation.levelsGained).toBe(1);
      expect(simulation.rewardsUnlocked).toEqual([]); // No rewards for level 3
    });

    it('should collect rewards for multiple level ups', () => {
      const simulation = experienceService.simulateProgression(0, 300);

      expect(simulation.levelsGained).toBeGreaterThan(1);
      expect(simulation.rewardsUnlocked).toContain('bronze-badge'); // Level 2 reward
    });
  });

  describe('Validation', () => {
    it('should validate XP award schema', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        experienceService.awardXP('user-123', {
          type: 'task',
          amount: 0, // Invalid: should be at least 1
          reason: 'Test',
        } as any)
      ).rejects.toThrow();
    });

    it('should validate XP award type', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        experienceService.awardXP('user-123', {
          type: 'invalid_type' as any,
          amount: 10,
          reason: 'Test',
        })
      ).rejects.toThrow();
    });
  });
});