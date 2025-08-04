import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HabitService } from '../services/HabitService';
import { HabitRepository } from '../repositories/HabitRepository';
import { ExperienceService } from '../services/ExperienceService';
import { CreateHabitRequest, UpdateHabitRequest, HabitQuery, CompleteHabitRequest } from '../models/Habit';

// Mock the dependencies
jest.mock('../repositories/HabitRepository');
jest.mock('../services/ExperienceService');

const MockedHabitRepository = HabitRepository as jest.MockedClass<typeof HabitRepository>;
const MockedExperienceService = ExperienceService as jest.MockedClass<typeof ExperienceService>;

describe('HabitService', () => {
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

  describe('createHabit', () => {
    it('should create a habit with correct XP reward', async () => {
      const habitData: CreateHabitRequest = {
        name: 'Daily Exercise',
        description: 'Exercise for 30 minutes',
        frequency: 'daily',
        targetStreak: 30,
        category: 'health'
      };

      const expectedHabit = {
        id: testHabitId,
        userId: testUserId,
        name: 'Daily Exercise',
        description: 'Exercise for 30 minutes',
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

      mockHabitRepository.create.mockResolvedValue(expectedHabit as any);

      const result = await habitService.createHabit(testUserId, habitData);

      expect(mockHabitRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          name: 'Daily Exercise',
          frequency: 'daily',
          targetStreak: 30,
          xpPerCompletion: 30,
          bonusXPStreak: 15,
          currentStreak: 0,
          longestStreak: 0,
          totalCompletions: 0,
          isActive: true,
          isPaused: false
        })
      );
      expect(result).toEqual(expectedHabit);
    });

    it('should calculate different XP for weekly habits', async () => {
      const habitData: CreateHabitRequest = {
        name: 'Weekly Reading',
        frequency: 'weekly',
        targetStreak: 10
      };

      const expectedHabit = {
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

      mockHabitRepository.create.mockResolvedValue(expectedHabit as any);

      const result = await habitService.createHabit(testUserId, habitData);

      expect(mockHabitRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          xpPerCompletion: 55,
          bonusXPStreak: 27
        })
      );
    });
  });

  describe('getHabitById', () => {
    it('should return habit if found and belongs to user', async () => {
      const expectedHabit = {
        id: testHabitId,
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        currentStreak: 5
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(expectedHabit as any);

      const result = await habitService.getHabitById(testHabitId, testUserId);

      expect(mockHabitRepository.findByIdAndUserId).toHaveBeenCalledWith(testHabitId, testUserId);
      expect(result).toEqual(expectedHabit);
    });

    it('should return null if habit not found', async () => {
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await habitService.getHabitById(testHabitId, testUserId);

      expect(result).toBeNull();
    });
  });

  describe('getHabits', () => {
    it('should return paginated habits with metadata', async () => {
      const query: HabitQuery = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      const mockHabits = [
        { id: '1', name: 'Habit 1', userId: testUserId },
        { id: '2', name: 'Habit 2', userId: testUserId }
      ];

      mockHabitRepository.findByUserId.mockResolvedValue({
        habits: mockHabits as any,
        total: 2
      });

      const result = await habitService.getHabits(testUserId, query);

      expect(mockHabitRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page: 1,
        limit: 10
      });

      expect(result).toEqual({
        habits: mockHabits,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      });
    });
  });

  describe('updateHabit', () => {
    it('should update habit and recalculate XP if frequency changed', async () => {
      const existingHabit = {
        id: testHabitId,
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 30
      };

      const updates: UpdateHabitRequest = {
        frequency: 'weekly',
        targetStreak: 20
      };

      const updatedHabit = {
        ...existingHabit,
        frequency: 'weekly',
        targetStreak: 20,
        xpPerCompletion: 60 // 50 base + 10 streak bonus (20/10 * 5)
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(existingHabit as any);
      mockHabitRepository.update.mockResolvedValue(updatedHabit as any);

      const result = await habitService.updateHabit(testHabitId, testUserId, updates);

      expect(mockHabitRepository.update).toHaveBeenCalledWith(
        testHabitId,
        testUserId,
        expect.objectContaining({
          frequency: 'weekly',
          targetStreak: 20,
          xpPerCompletion: 60,
          bonusXPStreak: 30
        })
      );
      expect(result).toEqual(updatedHabit);
    });

    it('should return null if habit not found', async () => {
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await habitService.updateHabit(testHabitId, testUserId, {});

      expect(result).toBeNull();
    });
  });

  describe('deleteHabit', () => {
    it('should delete habit', async () => {
      mockHabitRepository.delete.mockResolvedValue(true);

      const result = await habitService.deleteHabit(testHabitId, testUserId);

      expect(mockHabitRepository.delete).toHaveBeenCalledWith(testHabitId, testUserId);
      expect(result).toBe(true);
    });
  });

  describe('completeHabit', () => {
    it('should complete habit and award XP', async () => {
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

      const completionData: CompleteHabitRequest = {
        completedDate: '2024-01-15',
        notes: 'Great workout today!'
      };

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

      const updatedHabit = {
        ...existingHabit,
        currentStreak: 5,
        longestStreak: 10,
        totalCompletions: 21,
        lastCompletedAt: new Date()
      };

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

      const result = await habitService.completeHabit(testHabitId, testUserId, completionData);

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

      expect(result).toEqual({
        habit: updatedHabit,
        completion: newCompletion,
        xpAwarded: 15,
        bonusXPAwarded: 5,
        streakUpdated: true
      });
    });

    it('should throw error if habit already completed for date', async () => {
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

    it('should throw error if habit is paused', async () => {
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

    it('should return null if habit not found', async () => {
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await habitService.completeHabit(testHabitId, testUserId, {});

      expect(result).toBeNull();
    });
  });

  describe('getHabitCompletions', () => {
    it('should return completions for valid habit', async () => {
      const habit = { id: testHabitId, userId: testUserId };
      const completions = [
        { id: '1', habitId: testHabitId, completedDate: '2024-01-15' },
        { id: '2', habitId: testHabitId, completedDate: '2024-01-14' }
      ];

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);
      mockHabitRepository.getHabitCompletions.mockResolvedValue(completions as any);

      const result = await habitService.getHabitCompletions(testHabitId, testUserId);

      expect(mockHabitRepository.getHabitCompletions).toHaveBeenCalledWith(testHabitId, testUserId);
      expect(result).toEqual(completions);
    });

    it('should return empty array if habit not found', async () => {
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await habitService.getHabitCompletions(testHabitId, testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('getHabitCompletionRate', () => {
    it('should calculate completion rate for daily habit', async () => {
      const habit = {
        id: testHabitId,
        userId: testUserId,
        frequency: 'daily',
        customFrequency: null
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);
      mockHabitRepository.getCompletionCount.mockResolvedValue(25);

      const result = await habitService.getHabitCompletionRate(
        testHabitId,
        testUserId,
        '2024-01-01',
        '2024-01-30'
      );

      expect(result).toEqual({
        period: '2024-01-01 to 2024-01-30',
        completionRate: 83.33, // 25/30 * 100
        expectedCompletions: 30,
        actualCompletions: 25,
        missedDays: 5
      });
    });

    it('should return null if habit not found', async () => {
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await habitService.getHabitCompletionRate(
        testHabitId,
        testUserId,
        '2024-01-01',
        '2024-01-30'
      );

      expect(result).toBeNull();
    });
  });

  describe('getHabitStreakAnalysis', () => {
    it('should analyze habit streaks', async () => {
      const habit = {
        id: testHabitId,
        userId: testUserId,
        currentStreak: 5,
        longestStreak: 15,
        frequency: 'daily'
      };

      const completions = [
        { id: '1', completedDate: '2024-01-15' },
        { id: '2', completedDate: '2024-01-14' },
        { id: '3', completedDate: '2024-01-13' },
        { id: '4', completedDate: '2024-01-10' },
        { id: '5', completedDate: '2024-01-09' }
      ];

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);
      mockHabitRepository.getHabitCompletions.mockResolvedValue(completions as any);

      const result = await habitService.getHabitStreakAnalysis(testHabitId, testUserId);

      expect(result).toEqual({
        currentStreak: 5,
        longestStreak: 15,
        streakHistory: expect.any(Array),
        averageStreakLength: expect.any(Number),
        streakBreaks: expect.any(Number)
      });
    });

    it('should return null if habit not found', async () => {
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await habitService.getHabitStreakAnalysis(testHabitId, testUserId);

      expect(result).toBeNull();
    });
  });

  describe('toggleHabitPause', () => {
    it('should pause habit', async () => {
      const pausedHabit = {
        id: testHabitId,
        userId: testUserId,
        isPaused: true,
        pauseReason: 'Taking a break'
      };

      mockHabitRepository.togglePause.mockResolvedValue(pausedHabit as any);

      const result = await habitService.toggleHabitPause(testHabitId, testUserId, true, 'Taking a break');

      expect(mockHabitRepository.togglePause).toHaveBeenCalledWith(
        testHabitId,
        testUserId,
        true,
        'Taking a break'
      );
      expect(result).toEqual(pausedHabit);
    });
  });

  describe('shouldCompleteToday', () => {
    it('should return true for daily habit', async () => {
      const habit = {
        id: testHabitId,
        userId: testUserId,
        frequency: 'daily',
        isActive: true,
        isPaused: false
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);

      const result = await habitService.shouldCompleteToday(testHabitId, testUserId);

      expect(result).toBe(true);
    });

    it('should return false for paused habit', async () => {
      const habit = {
        id: testHabitId,
        userId: testUserId,
        frequency: 'daily',
        isActive: true,
        isPaused: true
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);

      const result = await habitService.shouldCompleteToday(testHabitId, testUserId);

      expect(result).toBe(false);
    });

    it('should return false for inactive habit', async () => {
      const habit = {
        id: testHabitId,
        userId: testUserId,
        frequency: 'daily',
        isActive: false,
        isPaused: false
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);

      const result = await habitService.shouldCompleteToday(testHabitId, testUserId);

      expect(result).toBe(false);
    });

    it('should return false if habit not found', async () => {
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await habitService.shouldCompleteToday(testHabitId, testUserId);

      expect(result).toBe(false);
    });
  });

  describe('getHabitStats', () => {
    it('should return habit statistics', async () => {
      const stats = {
        total: 5,
        active: 4,
        paused: 1,
        totalCompletions: 100,
        averageStreak: 7.5,
        longestOverallStreak: 25
      };

      mockHabitRepository.getHabitStats.mockResolvedValue(stats);

      const result = await habitService.getHabitStats(testUserId);

      expect(mockHabitRepository.getHabitStats).toHaveBeenCalledWith(testUserId);
      expect(result).toEqual(stats);
    });
  });
});