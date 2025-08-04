import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HabitService } from '../services/HabitService';
import { HabitRepository } from '../repositories/HabitRepository';
import { ExperienceService } from '../services/ExperienceService';

// Mock the dependencies
jest.mock('../repositories/HabitRepository');
jest.mock('../services/ExperienceService');

const MockedHabitRepository = HabitRepository as jest.MockedClass<typeof HabitRepository>;
const MockedExperienceService = ExperienceService as jest.MockedClass<typeof ExperienceService>;

describe('Habit Functionality Verification', () => {
  let habitService: HabitService;
  let mockHabitRepository: jest.Mocked<HabitRepository>;
  let mockExperienceService: jest.Mocked<ExperienceService>;

  const testUserId = 'test-user-id';
  const testHabitId = 'test-habit-id';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked instances
    mockHabitRepository = new MockedHabitRepository() as jest.Mocked<HabitRepository>;
    mockExperienceService = new MockedExperienceService() as jest.Mocked<ExperienceService>;

    // Create service instance
    habitService = new HabitService();

    // Replace the private instances with mocks
    (habitService as any).habitRepository = mockHabitRepository;
    (habitService as any).experienceService = mockExperienceService;
  });

  describe('Habit Completion and Streak Tracking', () => {
    it('should complete habit and update streak correctly', async () => {
      // Mock existing habit
      const existingHabit = {
        id: testHabitId,
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        bonusXPStreak: 5,
        currentStreak: 4,
        longestStreak: 10,
        totalCompletions: 20,
        isActive: true,
        isPaused: false,
        lastCompletedAt: new Date('2024-01-14')
      };

      // Mock completion data
      const completionData = {
        completedDate: '2024-01-15',
        notes: 'Great workout today!'
      };

      // Mock new completion
      const newCompletion = {
        id: 'completion-id',
        habitId: testHabitId,
        userId: testUserId,
        completedDate: '2024-01-15',
        notes: 'Great workout today!',
        streakAtCompletion: 5,
        xpAwarded: 15,
        bonusXPAwarded: 5
      };

      // Mock updated habit
      const updatedHabit = {
        ...existingHabit,
        currentStreak: 5,
        longestStreak: 10,
        totalCompletions: 21,
        lastCompletedAt: new Date()
      };

      // Setup mocks
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(existingHabit as any);
      mockHabitRepository.findCompletionByDate.mockResolvedValue(null);
      mockHabitRepository.createCompletion.mockResolvedValue(newCompletion as any);
      mockHabitRepository.updateStreakInfo.mockResolvedValue(updatedHabit as any);
      mockExperienceService.awardHabitXP.mockResolvedValue({
        xpAwarded: 20,
        previousLevel: 1,
        newLevel: 1,
        leveledUp: false,
        newLevelInfo: {
          level: 1,
          currentXP: 50,
          nextLevelXP: 100,
          totalXP: 50,
          progressToNext: 50,
          isMaxLevel: false
        }
      });

      // Execute
      const result = await habitService.completeHabit(testHabitId, testUserId, completionData);

      // Verify
      expect(result).toBeDefined();
      expect(result!.habit.currentStreak).toBe(5);
      expect(result!.xpAwarded).toBe(15);
      expect(result!.bonusXPAwarded).toBe(5);
      expect(result!.streakUpdated).toBe(true);

      // Verify repository calls
      expect(mockHabitRepository.createCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          habitId: testHabitId,
          userId: testUserId,
          completedDate: '2024-01-15',
          notes: 'Great workout today!',
          streakAtCompletion: 5,
          xpAwarded: 15,
          bonusXPAwarded: 5
        })
      );

      expect(mockHabitRepository.updateStreakInfo).toHaveBeenCalledWith(
        testHabitId,
        testUserId,
        expect.objectContaining({
          currentStreak: 5,
          longestStreak: 10,
          totalCompletions: 21
        })
      );

      expect(mockExperienceService.awardHabitXP).toHaveBeenCalledWith(
        testUserId,
        'daily',
        'Daily Exercise',
        5,
        expect.objectContaining({
          habitId: testHabitId,
          bonusXP: 5,
          completionDate: '2024-01-15'
        })
      );
    });

    it('should handle streak reset when habit completion is not consecutive', async () => {
      // Mock existing habit with last completion 3 days ago
      const existingHabit = {
        id: testHabitId,
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        bonusXPStreak: 5,
        currentStreak: 5,
        longestStreak: 10,
        totalCompletions: 20,
        isActive: true,
        isPaused: false,
        lastCompletedAt: new Date('2024-01-12') // 3 days ago
      };

      const completionData = {
        completedDate: '2024-01-15'
      };

      const newCompletion = {
        id: 'completion-id',
        habitId: testHabitId,
        userId: testUserId,
        completedDate: '2024-01-15',
        streakAtCompletion: 1, // Reset to 1
        xpAwarded: 15,
        bonusXPAwarded: 0 // No bonus for broken streak
      };

      const updatedHabit = {
        ...existingHabit,
        currentStreak: 1, // Reset streak
        longestStreak: 10, // Unchanged
        totalCompletions: 21,
        lastCompletedAt: new Date()
      };

      // Setup mocks
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(existingHabit as any);
      mockHabitRepository.findCompletionByDate.mockResolvedValue(null);
      mockHabitRepository.createCompletion.mockResolvedValue(newCompletion as any);
      mockHabitRepository.updateStreakInfo.mockResolvedValue(updatedHabit as any);
      mockExperienceService.awardHabitXP.mockResolvedValue({
        xpAwarded: 15,
        previousLevel: 1,
        newLevel: 1,
        leveledUp: false,
        newLevelInfo: {
          level: 1,
          currentXP: 50,
          nextLevelXP: 100,
          totalXP: 50,
          progressToNext: 50,
          isMaxLevel: false
        }
      });

      // Execute
      const result = await habitService.completeHabit(testHabitId, testUserId, completionData);

      // Verify streak was reset
      expect(result).toBeDefined();
      expect(result!.habit.currentStreak).toBe(1);
      expect(result!.xpAwarded).toBe(15);
      expect(result!.bonusXPAwarded).toBe(0); // No bonus for broken streak
      expect(result!.streakUpdated).toBe(true);

      // Verify streak info update
      expect(mockHabitRepository.updateStreakInfo).toHaveBeenCalledWith(
        testHabitId,
        testUserId,
        expect.objectContaining({
          currentStreak: 1,
          longestStreak: 10,
          totalCompletions: 21
        })
      );
    });

    it('should prevent duplicate completions for the same date', async () => {
      const existingHabit = {
        id: testHabitId,
        userId: testUserId,
        isActive: true,
        isPaused: false
      };

      const existingCompletion = {
        id: 'existing-completion',
        habitId: testHabitId,
        completedDate: '2024-01-15'
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(existingHabit as any);
      mockHabitRepository.findCompletionByDate.mockResolvedValue(existingCompletion as any);

      await expect(
        habitService.completeHabit(testHabitId, testUserId, { completedDate: '2024-01-15' })
      ).rejects.toThrow('Habit already completed for this date');
    });

    it('should prevent completion of paused habits', async () => {
      const pausedHabit = {
        id: testHabitId,
        userId: testUserId,
        isActive: true,
        isPaused: true
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(pausedHabit as any);

      await expect(
        habitService.completeHabit(testHabitId, testUserId, {})
      ).rejects.toThrow('Cannot complete a paused or inactive habit');
    });

    it('should prevent completion of inactive habits', async () => {
      const inactiveHabit = {
        id: testHabitId,
        userId: testUserId,
        isActive: false,
        isPaused: false
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(inactiveHabit as any);

      await expect(
        habitService.completeHabit(testHabitId, testUserId, {})
      ).rejects.toThrow('Cannot complete a paused or inactive habit');
    });
  });

  describe('Streak Calculation Logic', () => {
    it('should calculate XP reward based on frequency and target streak', async () => {
      // Test daily habit
      const dailyHabitData = {
        name: 'Daily Exercise',
        frequency: 'daily' as const,
        targetStreak: 30
      };

      const expectedDailyHabit = {
        id: testHabitId,
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 30, // 15 base + 15 streak bonus (30/10 * 5)
        bonusXPStreak: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockHabitRepository.create.mockResolvedValue(expectedDailyHabit as any);

      const result = await habitService.createHabit(testUserId, dailyHabitData);

      expect(mockHabitRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          xpPerCompletion: 30,
          bonusXPStreak: 15
        })
      );
    });

    it('should calculate different XP for weekly habits', async () => {
      const weeklyHabitData = {
        name: 'Weekly Reading',
        frequency: 'weekly' as const,
        targetStreak: 10
      };

      const expectedWeeklyHabit = {
        id: testHabitId,
        userId: testUserId,
        name: 'Weekly Reading',
        frequency: 'weekly',
        targetStreak: 10,
        xpPerCompletion: 55, // 50 base + 5 streak bonus (10/10 * 5)
        bonusXPStreak: 27,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockHabitRepository.create.mockResolvedValue(expectedWeeklyHabit as any);

      const result = await habitService.createHabit(testUserId, weeklyHabitData);

      expect(mockHabitRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          xpPerCompletion: 55,
          bonusXPStreak: 27
        })
      );
    });
  });

  describe('Habit Frequency Logic', () => {
    it('should determine completion requirement for daily habits', async () => {
      const dailyHabit = {
        id: testHabitId,
        userId: testUserId,
        frequency: 'daily',
        isActive: true,
        isPaused: false
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(dailyHabit as any);

      const result = await habitService.shouldCompleteToday(testHabitId, testUserId);

      expect(result).toBe(true);
    });

    it('should return false for paused habits', async () => {
      const pausedHabit = {
        id: testHabitId,
        userId: testUserId,
        frequency: 'daily',
        isActive: true,
        isPaused: true
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(pausedHabit as any);

      const result = await habitService.shouldCompleteToday(testHabitId, testUserId);

      expect(result).toBe(false);
    });

    it('should return false for inactive habits', async () => {
      const inactiveHabit = {
        id: testHabitId,
        userId: testUserId,
        frequency: 'daily',
        isActive: false,
        isPaused: false
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(inactiveHabit as any);

      const result = await habitService.shouldCompleteToday(testHabitId, testUserId);

      expect(result).toBe(false);
    });
  });
});