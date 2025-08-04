import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { HabitService } from '../services/HabitService';
import habitRoutes from '../routes/habits';
import { authenticate } from '../middleware/auth';

// Mock the HabitService
jest.mock('../services/HabitService');
const MockedHabitService = HabitService as jest.MockedClass<typeof HabitService>;

// Mock the auth middleware
jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  })
}));

describe('Habit Routes', () => {
  let app: express.Application;
  let mockHabitService: jest.Mocked<HabitService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create express app
    app = express();
    app.use(express.json());
    app.use('/api/habits', habitRoutes);

    // Get the mocked service instance
    mockHabitService = MockedHabitService.mock.instances[0] as jest.Mocked<HabitService>;
  });

  describe('GET /api/habits', () => {
    it('should return paginated habits', async () => {
      const mockResponse = {
        habits: [
          { id: '1', name: 'Daily Exercise', frequency: 'daily' },
          { id: '2', name: 'Weekly Reading', frequency: 'weekly' }
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      mockHabitService.getHabits = jest.fn().mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/habits')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResponse
      });

      expect(mockHabitService.getHabits).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          page: 1,
          limit: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        })
      );
    });

    it('should handle query parameters', async () => {
      const mockResponse = {
        habits: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0
      };

      mockHabitService.getHabits = jest.fn().mockResolvedValue(mockResponse);

      await request(app)
        .get('/api/habits?page=2&limit=10&sortBy=currentStreak&sortOrder=desc&filter[frequency]=daily')
        .expect(200);

      expect(mockHabitService.getHabits).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          page: 2,
          limit: 10,
          sortBy: 'currentStreak',
          sortOrder: 'desc'
        })
      );
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .get('/api/habits?page=0&limit=1000')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/habits/:id', () => {
    it('should return habit by ID', async () => {
      const mockHabit = {
        id: 'habit-id',
        name: 'Daily Exercise',
        frequency: 'daily',
        currentStreak: 5
      };

      mockHabitService.getHabitById = jest.fn().mockResolvedValue(mockHabit);

      const response = await request(app)
        .get('/api/habits/habit-id')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockHabit
      });

      expect(mockHabitService.getHabitById).toHaveBeenCalledWith('habit-id', 'test-user-id');
    });

    it('should return 404 if habit not found', async () => {
      mockHabitService.getHabitById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/habits/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HABIT_NOT_FOUND');
    });
  });

  describe('POST /api/habits', () => {
    it('should create a new habit', async () => {
      const habitData = {
        name: 'Daily Exercise',
        description: 'Exercise for 30 minutes',
        frequency: 'daily',
        targetStreak: 30
      };

      const mockCreatedHabit = {
        id: 'new-habit-id',
        ...habitData,
        userId: 'test-user-id',
        currentStreak: 0,
        isActive: true
      };

      mockHabitService.createHabit = jest.fn().mockResolvedValue(mockCreatedHabit);

      const response = await request(app)
        .post('/api/habits')
        .send(habitData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: mockCreatedHabit
      });

      expect(mockHabitService.createHabit).toHaveBeenCalledWith('test-user-id', habitData);
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        frequency: 'invalid'
      };

      const response = await request(app)
        .post('/api/habits')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/habits/:id', () => {
    it('should update a habit', async () => {
      const updateData = {
        name: 'Updated Exercise',
        targetStreak: 60
      };

      const mockUpdatedHabit = {
        id: 'habit-id',
        name: 'Updated Exercise',
        targetStreak: 60,
        userId: 'test-user-id'
      };

      mockHabitService.updateHabit = jest.fn().mockResolvedValue(mockUpdatedHabit);

      const response = await request(app)
        .put('/api/habits/habit-id')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockUpdatedHabit
      });

      expect(mockHabitService.updateHabit).toHaveBeenCalledWith('habit-id', 'test-user-id', updateData);
    });

    it('should return 404 if habit not found', async () => {
      mockHabitService.updateHabit = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put('/api/habits/non-existent-id')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HABIT_NOT_FOUND');
    });
  });

  describe('DELETE /api/habits/:id', () => {
    it('should delete a habit', async () => {
      mockHabitService.deleteHabit = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/habits/habit-id')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Habit deleted successfully'
      });

      expect(mockHabitService.deleteHabit).toHaveBeenCalledWith('habit-id', 'test-user-id');
    });

    it('should return 404 if habit not found', async () => {
      mockHabitService.deleteHabit = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/habits/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HABIT_NOT_FOUND');
    });
  });

  describe('PATCH /api/habits/:id/complete', () => {
    it('should complete a habit', async () => {
      const completionData = {
        completedDate: '2024-01-15',
        notes: 'Great workout today!'
      };

      const mockResult = {
        habit: { id: 'habit-id', currentStreak: 6 },
        completion: { id: 'completion-id', completedDate: '2024-01-15' },
        xpAwarded: 15,
        bonusXPAwarded: 5,
        streakUpdated: true
      };

      mockHabitService.completeHabit = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .patch('/api/habits/habit-id/complete')
        .send(completionData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });

      expect(mockHabitService.completeHabit).toHaveBeenCalledWith('habit-id', 'test-user-id', completionData);
    });

    it('should handle completion errors', async () => {
      mockHabitService.completeHabit = jest.fn().mockRejectedValue(new Error('Habit already completed for this date'));

      const response = await request(app)
        .patch('/api/habits/habit-id/complete')
        .send({ completedDate: '2024-01-15' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('COMPLETION_ERROR');
      expect(response.body.error.message).toBe('Habit already completed for this date');
    });

    it('should return 404 if habit not found', async () => {
      mockHabitService.completeHabit = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/habits/non-existent-id/complete')
        .send({ completedDate: '2024-01-15' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HABIT_NOT_FOUND');
    });
  });

  describe('PATCH /api/habits/:id/pause', () => {
    it('should pause a habit', async () => {
      const mockPausedHabit = {
        id: 'habit-id',
        isPaused: true,
        pauseReason: 'Taking a break'
      };

      mockHabitService.toggleHabitPause = jest.fn().mockResolvedValue(mockPausedHabit);

      const response = await request(app)
        .patch('/api/habits/habit-id/pause')
        .send({ isPaused: true, reason: 'Taking a break' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPausedHabit
      });

      expect(mockHabitService.toggleHabitPause).toHaveBeenCalledWith('habit-id', 'test-user-id', true, 'Taking a break');
    });

    it('should unpause a habit', async () => {
      const mockUnpausedHabit = {
        id: 'habit-id',
        isPaused: false,
        pauseReason: null
      };

      mockHabitService.toggleHabitPause = jest.fn().mockResolvedValue(mockUnpausedHabit);

      const response = await request(app)
        .patch('/api/habits/habit-id/pause')
        .send({ isPaused: false })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockUnpausedHabit
      });

      expect(mockHabitService.toggleHabitPause).toHaveBeenCalledWith('habit-id', 'test-user-id', false, undefined);
    });

    it('should handle invalid pause status', async () => {
      const response = await request(app)
        .patch('/api/habits/habit-id/pause')
        .send({ isPaused: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PAUSE_STATUS');
    });
  });

  describe('GET /api/habits/:id/completions', () => {
    it('should return habit completions', async () => {
      const mockCompletions = [
        { id: '1', completedDate: '2024-01-15', notes: 'Great workout!' },
        { id: '2', completedDate: '2024-01-14', notes: 'Good session' }
      ];

      mockHabitService.getHabitCompletions = jest.fn().mockResolvedValue(mockCompletions);

      const response = await request(app)
        .get('/api/habits/habit-id/completions')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockCompletions
      });

      expect(mockHabitService.getHabitCompletions).toHaveBeenCalledWith('habit-id', 'test-user-id');
    });

    it('should return completions in date range', async () => {
      const mockCompletions = [
        { id: '1', completedDate: '2024-01-15' }
      ];

      mockHabitService.getHabitCompletionsInRange = jest.fn().mockResolvedValue(mockCompletions);

      const response = await request(app)
        .get('/api/habits/habit-id/completions?startDate=2024-01-15&endDate=2024-01-16')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockCompletions
      });

      expect(mockHabitService.getHabitCompletionsInRange).toHaveBeenCalledWith(
        'habit-id',
        'test-user-id',
        '2024-01-15',
        '2024-01-16'
      );
    });

    it('should handle invalid date format', async () => {
      const response = await request(app)
        .get('/api/habits/habit-id/completions?startDate=invalid&endDate=2024-01-16')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT');
    });
  });

  describe('GET /api/habits/:id/analytics', () => {
    it('should return habit analytics', async () => {
      const mockStreakAnalysis = {
        currentStreak: 5,
        longestStreak: 15,
        streakHistory: [],
        averageStreakLength: 7.5,
        streakBreaks: 2
      };

      const mockCompletionRate = {
        period: '2024-01-01 to 2024-01-31',
        completionRate: 85.5,
        expectedCompletions: 31,
        actualCompletions: 26,
        missedDays: 5
      };

      mockHabitService.getHabitStreakAnalysis = jest.fn().mockResolvedValue(mockStreakAnalysis);
      mockHabitService.getHabitCompletionRate = jest.fn().mockResolvedValue(mockCompletionRate);

      const response = await request(app)
        .get('/api/habits/habit-id/analytics?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          streakAnalysis: mockStreakAnalysis,
          completionRate: mockCompletionRate
        }
      });

      expect(mockHabitService.getHabitStreakAnalysis).toHaveBeenCalledWith('habit-id', 'test-user-id');
      expect(mockHabitService.getHabitCompletionRate).toHaveBeenCalledWith(
        'habit-id',
        'test-user-id',
        '2024-01-01',
        '2024-01-31'
      );
    });

    it('should return 404 if habit not found', async () => {
      mockHabitService.getHabitStreakAnalysis = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/habits/non-existent-id/analytics')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HABIT_NOT_FOUND');
    });
  });

  describe('GET /api/habits/stats', () => {
    it('should return habit statistics', async () => {
      const mockStats = {
        total: 5,
        active: 4,
        paused: 1,
        totalCompletions: 100,
        averageStreak: 7.5,
        longestOverallStreak: 25
      };

      mockHabitService.getHabitStats = jest.fn().mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/habits/stats')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStats
      });

      expect(mockHabitService.getHabitStats).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('GET /api/habits/:id/should-complete', () => {
    it('should check if habit should be completed today', async () => {
      mockHabitService.shouldCompleteToday = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .get('/api/habits/habit-id/should-complete')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          shouldComplete: true,
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        }
      });

      expect(mockHabitService.shouldCompleteToday).toHaveBeenCalledWith('habit-id', 'test-user-id', undefined);
    });

    it('should check for specific date', async () => {
      mockHabitService.shouldCompleteToday = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .get('/api/habits/habit-id/should-complete?date=2024-01-15')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          shouldComplete: false,
          date: '2024-01-15'
        }
      });

      expect(mockHabitService.shouldCompleteToday).toHaveBeenCalledWith('habit-id', 'test-user-id', '2024-01-15');
    });
  });
});