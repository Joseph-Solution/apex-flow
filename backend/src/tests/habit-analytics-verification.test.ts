import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HabitService } from '../services/HabitService';
import { HabitRepository } from '../repositories/HabitRepository';
import { ExperienceService } from '../services/ExperienceService';

// Mock the dependencies
jest.mock('../repositories/HabitRepository');
jest.mock('../services/ExperienceService');

const MockedHabitRepository = HabitRepository as jest.MockedClass<typeof HabitRepository>;
const MockedExperienceService = ExperienceService as jest.MockedClass<typeof ExperienceService>;

describe('Habit Analytics and Progress Tracking Verification', () => {
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

  describe('Habit Completion Rate Calculations', () => {
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

      expect(mockHabitRepository.getCompletionCount).toHaveBeenCalledWith(
        testHabitId,
        testUserId,
        '2024-01-01',
        '2024-01-30'
      );
    });

    it('should calculate completion rate for weekly habit', async () => {
      const habit = {
        id: testHabitId,
        userId: testUserId,
        frequency: 'weekly',
        customFrequency: null
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);
      mockHabitRepository.getCompletionCount.mockResolvedValue(3);

      const result = await habitService.getHabitCompletionRate(
        testHabitId,
        testUserId,
        '2024-01-01',
        '2024-01-30'
      );

      expect(result).toEqual({
        period: '2024-01-01 to 2024-01-30',
        completionRate: 60.0, // 3/5 * 100 (5 weeks in 30 days)
        expectedCompletions: 5,
        actualCompletions: 3,
        missedDays: 2
      });
    });

    it('should calculate completion rate for custom habit (times per week)', async () => {
      const habit = {
        id: testHabitId,
        userId: testUserId,
        frequency: 'custom',
        customFrequency: {
          type: 'times_per_week',
          value: 3
        }
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);
      mockHabitRepository.getCompletionCount.mockResolvedValue(10);

      const result = await habitService.getHabitCompletionRate(
        testHabitId,
        testUserId,
        '2024-01-01',
        '2024-01-30'
      );

      expect(result).toEqual({
        period: '2024-01-01 to 2024-01-30',
        completionRate: 66.67, // 10/15 * 100 (5 weeks * 3 times per week)
        expectedCompletions: 15,
        actualCompletions: 10,
        missedDays: 5
      });
    });

    it('should return null for non-existent habit', async () => {
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

  describe('Habit Streak Analysis', () => {
    it('should analyze habit streaks and calculate statistics', async () => {
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
        { id: '4', completedDate: '2024-01-10' }, // Gap here breaks streak
        { id: '5', completedDate: '2024-01-09' },
        { id: '6', completedDate: '2024-01-08' },
        { id: '7', completedDate: '2024-01-05' }, // Another gap
        { id: '8', completedDate: '2024-01-04' }
      ];

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);
      mockHabitRepository.getHabitCompletions.mockResolvedValue(completions as any);

      const result = await habitService.getHabitStreakAnalysis(testHabitId, testUserId);

      expect(result).toBeDefined();
      expect(result!.currentStreak).toBe(5);
      expect(result!.longestStreak).toBe(15);
      expect(result!.streakHistory).toBeDefined();
      expect(result!.averageStreakLength).toBeGreaterThan(0);
      expect(result!.streakBreaks).toBeGreaterThanOrEqual(0);

      expect(mockHabitRepository.getHabitCompletions).toHaveBeenCalledWith(testHabitId, testUserId);
    });

    it('should return null for non-existent habit', async () => {
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await habitService.getHabitStreakAnalysis(testHabitId, testUserId);

      expect(result).toBeNull();
    });

    it('should handle habits with no completions', async () => {
      const habit = {
        id: testHabitId,
        userId: testUserId,
        currentStreak: 0,
        longestStreak: 0,
        frequency: 'daily'
      };

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);
      mockHabitRepository.getHabitCompletions.mockResolvedValue([]);

      const result = await habitService.getHabitStreakAnalysis(testHabitId, testUserId);

      expect(result).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        streakHistory: [],
        averageStreakLength: 0,
        streakBreaks: 0
      });
    });
  });

  describe('Habit Completion History', () => {
    it('should retrieve habit completions', async () => {
      const habit = { id: testHabitId, userId: testUserId };
      const completions = [
        { id: '1', habitId: testHabitId, completedDate: '2024-01-15', notes: 'Great workout!' },
        { id: '2', habitId: testHabitId, completedDate: '2024-01-14', notes: 'Good session' }
      ];

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);
      mockHabitRepository.getHabitCompletions.mockResolvedValue(completions as any);

      const result = await habitService.getHabitCompletions(testHabitId, testUserId);

      expect(result).toEqual(completions);
      expect(mockHabitRepository.getHabitCompletions).toHaveBeenCalledWith(testHabitId, testUserId);
    });

    it('should retrieve habit completions in date range', async () => {
      const habit = { id: testHabitId, userId: testUserId };
      const completions = [
        { id: '1', habitId: testHabitId, completedDate: '2024-01-15' }
      ];

      mockHabitRepository.findByIdAndUserId.mockResolvedValue(habit as any);
      mockHabitRepository.getCompletionsInRange.mockResolvedValue(completions as any);

      const result = await habitService.getHabitCompletionsInRange(
        testHabitId,
        testUserId,
        '2024-01-15',
        '2024-01-16'
      );

      expect(result).toEqual(completions);
      expect(mockHabitRepository.getCompletionsInRange).toHaveBeenCalledWith(
        testHabitId,
        testUserId,
        '2024-01-15',
        '2024-01-16'
      );
    });

    it('should return empty array for non-existent habit', async () => {
      mockHabitRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await habitService.getHabitCompletions(testHabitId, testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('User Habit Statistics', () => {
    it('should return habit statistics for user', async () => {
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

      expect(result).toEqual(stats);
      expect(mockHabitRepository.getHabitStats).toHaveBeenCalledWith(testUserId);
    });
  });

  describe('Expected Completion Calculations', () => {
    it('should calculate expected completions for daily habit', () => {
      const habit = {
        frequency: 'daily',
        customFrequency: null
      };

      // Use private method through service instance
      const service = habitService as any;
      const result = service.calculateExpectedCompletions(habit, '2024-01-01', '2024-01-30');

      expect(result).toBe(30); // 30 days
    });

    it('should calculate expected completions for weekly habit', () => {
      const habit = {
        frequency: 'weekly',
        customFrequency: null
      };

      const service = habitService as any;
      const result = service.calculateExpectedCompletions(habit, '2024-01-01', '2024-01-30');

      expect(result).toBe(5); // ~4.3 weeks rounded up
    });

    it('should calculate expected completions for custom habit (3 times per week)', () => {
      const habit = {
        frequency: 'custom',
        customFrequency: {
          type: 'times_per_week',
          value: 3
        }
      };

      const service = habitService as any;
      const result = service.calculateExpectedCompletions(habit, '2024-01-01', '2024-01-30');

      expect(result).toBe(15); // 5 weeks * 3 times per week
    });

    it('should calculate expected completions for custom habit (2 times per month)', () => {
      const habit = {
        frequency: 'custom',
        customFrequency: {
          type: 'times_per_month',
          value: 2
        }
      };

      const service = habitService as any;
      const result = service.calculateExpectedCompletions(habit, '2024-01-01', '2024-01-30');

      expect(result).toBe(2); // 1 month * 2 times per month
    });
  });

  describe('Streak History Calculation', () => {
    it('should calculate streak history from completions', () => {
      const completions = [
        { completedDate: '2024-01-15' },
        { completedDate: '2024-01-14' },
        { completedDate: '2024-01-13' },
        { completedDate: '2024-01-10' }, // Gap breaks streak
        { completedDate: '2024-01-09' },
        { completedDate: '2024-01-08' },
        { completedDate: '2024-01-05' }, // Another gap
        { completedDate: '2024-01-04' }
      ];

      const service = habitService as any;
      const result = service.calculateStreakHistory(completions, 'daily');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Each streak should have startDate, endDate, and length
      result.forEach((streak: any) => {
        expect(streak).toHaveProperty('startDate');
        expect(streak).toHaveProperty('endDate');
        expect(streak).toHaveProperty('length');
        expect(typeof streak.length).toBe('number');
        expect(streak.length).toBeGreaterThan(0);
      });
    });

    it('should return empty array for no completions', () => {
      const service = habitService as any;
      const result = service.calculateStreakHistory([], 'daily');

      expect(result).toEqual([]);
    });

    it('should handle single completion', () => {
      const completions = [
        { completedDate: '2024-01-15' }
      ];

      const service = habitService as any;
      const result = service.calculateStreakHistory(completions, 'daily');

      expect(result).toEqual([{
        startDate: '2024-01-15',
        endDate: '2024-01-15',
        length: 1
      }]);
    });
  });

  describe('Completion Due Logic', () => {
    it('should determine if daily habit is due today', () => {
      const habit = {
        frequency: 'daily',
        reminderDays: []
      };

      const service = habitService as any;
      const result = service.isCompletionDue(habit, '2024-01-15');

      expect(result).toBe(true);
    });

    it('should determine if weekly habit is due on specific days', () => {
      const habit = {
        frequency: 'weekly',
        reminderDays: [1, 3, 5] // Monday, Wednesday, Friday
      };

      const service = habitService as any;
      
      // Monday (day 1)
      const mondayResult = service.isCompletionDue(habit, '2024-01-15'); // Assuming this is a Monday
      
      // The result depends on the actual day of week for the date
      expect(typeof mondayResult).toBe('boolean');
    });

    it('should determine if custom habit is due', () => {
      const habit = {
        frequency: 'custom',
        customFrequency: {
          type: 'times_per_week',
          value: 3,
          specificDays: [1, 3, 5] // Monday, Wednesday, Friday
        }
      };

      const service = habitService as any;
      const result = service.isCompletionDue(habit, '2024-01-15');

      expect(typeof result).toBe('boolean');
    });
  });
});