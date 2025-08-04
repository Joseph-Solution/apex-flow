import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { HabitRepository } from '../repositories/HabitRepository';
import { db } from '../db/connection';
import { habits, habitCompletions } from '../db/schema/habits';
import { users } from '../db/schema/users';
import { NewHabit, NewHabitCompletion } from '../models/Habit';
import { eq } from 'drizzle-orm';

describe('HabitRepository', () => {
  let habitRepository: HabitRepository;
  let testUserId: string;

  beforeEach(async () => {
    habitRepository = new HabitRepository();

    // Create a test user
    const [user] = await db.insert(users).values({
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      totalXP: 0,
      level: 1,
      currentLevelXP: 0,
      nextLevelXP: 100,
    }).returning();
    
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(habitCompletions);
    await db.delete(habits);
    await db.delete(users);
  });

  describe('create', () => {
    it('should create a new habit', async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Exercise',
        description: 'Exercise for 30 minutes',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const habit = await habitRepository.create(habitData);

      expect(habit).toBeDefined();
      expect(habit.id).toBeDefined();
      expect(habit.name).toBe('Daily Exercise');
      expect(habit.userId).toBe(testUserId);
      expect(habit.frequency).toBe('daily');
      expect(habit.currentStreak).toBe(0);
    });
  });

  describe('findById', () => {
    it('should find habit by ID', async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Reading',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdHabit = await habitRepository.create(habitData);
      const foundHabit = await habitRepository.findById(createdHabit.id);

      expect(foundHabit).toBeDefined();
      expect(foundHabit!.id).toBe(createdHabit.id);
      expect(foundHabit!.name).toBe('Daily Reading');
    });

    it('should return null for non-existent habit', async () => {
      const habit = await habitRepository.findById('non-existent-id');
      expect(habit).toBeNull();
    });
  });

  describe('findByIdAndUserId', () => {
    it('should find habit by ID and user ID', async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Meditation',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdHabit = await habitRepository.create(habitData);
      const foundHabit = await habitRepository.findByIdAndUserId(createdHabit.id, testUserId);

      expect(foundHabit).toBeDefined();
      expect(foundHabit!.id).toBe(createdHabit.id);
      expect(foundHabit!.userId).toBe(testUserId);
    });

    it('should return null for wrong user ID', async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Meditation',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdHabit = await habitRepository.create(habitData);
      const foundHabit = await habitRepository.findByIdAndUserId(createdHabit.id, 'wrong-user-id');

      expect(foundHabit).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all habits for a user', async () => {
      const habit1Data: NewHabit = {
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 5,
        longestStreak: 10,
        totalCompletions: 5,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const habit2Data: NewHabit = {
        userId: testUserId,
        name: 'Weekly Reading',
        frequency: 'weekly',
        targetStreak: 10,
        xpPerCompletion: 25,
        currentStreak: 2,
        longestStreak: 3,
        totalCompletions: 2,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await habitRepository.create(habit1Data);
      await habitRepository.create(habit2Data);

      const result = await habitRepository.findByUserId(testUserId);

      expect(result.habits).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.habits.some(h => h.name === 'Daily Exercise')).toBe(true);
      expect(result.habits.some(h => h.name === 'Weekly Reading')).toBe(true);
    });

    it('should filter habits by frequency', async () => {
      const habit1Data: NewHabit = {
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const habit2Data: NewHabit = {
        userId: testUserId,
        name: 'Weekly Reading',
        frequency: 'weekly',
        targetStreak: 10,
        xpPerCompletion: 25,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await habitRepository.create(habit1Data);
      await habitRepository.create(habit2Data);

      const result = await habitRepository.findByUserId(testUserId, {
        filter: { frequency: 'daily' }
      });

      expect(result.habits).toHaveLength(1);
      expect(result.habits[0].name).toBe('Daily Exercise');
      expect(result.habits[0].frequency).toBe('daily');
    });

    it('should sort habits by current streak', async () => {
      const habit1Data: NewHabit = {
        userId: testUserId,
        name: 'Low Streak Habit',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 2,
        longestStreak: 5,
        totalCompletions: 2,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const habit2Data: NewHabit = {
        userId: testUserId,
        name: 'High Streak Habit',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 10,
        longestStreak: 15,
        totalCompletions: 10,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await habitRepository.create(habit1Data);
      await habitRepository.create(habit2Data);

      const result = await habitRepository.findByUserId(testUserId, {
        sortBy: 'currentStreak',
        sortOrder: 'desc'
      });

      expect(result.habits).toHaveLength(2);
      expect(result.habits[0].name).toBe('High Streak Habit');
      expect(result.habits[0].currentStreak).toBe(10);
      expect(result.habits[1].name).toBe('Low Streak Habit');
      expect(result.habits[1].currentStreak).toBe(2);
    });
  });

  describe('update', () => {
    it('should update habit properties', async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdHabit = await habitRepository.create(habitData);
      
      const updatedHabit = await habitRepository.update(createdHabit.id, testUserId, {
        name: 'Updated Exercise',
        targetStreak: 60,
        description: 'Updated description'
      });

      expect(updatedHabit).toBeDefined();
      expect(updatedHabit!.name).toBe('Updated Exercise');
      expect(updatedHabit!.targetStreak).toBe(60);
      expect(updatedHabit!.description).toBe('Updated description');
    });
  });

  describe('updateStreakInfo', () => {
    it('should update streak information', async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdHabit = await habitRepository.create(habitData);
      const lastCompletedAt = new Date();
      
      const updatedHabit = await habitRepository.updateStreakInfo(createdHabit.id, testUserId, {
        currentStreak: 5,
        longestStreak: 5,
        totalCompletions: 5,
        lastCompletedAt
      });

      expect(updatedHabit).toBeDefined();
      expect(updatedHabit!.currentStreak).toBe(5);
      expect(updatedHabit!.longestStreak).toBe(5);
      expect(updatedHabit!.totalCompletions).toBe(5);
      expect(updatedHabit!.lastCompletedAt).toEqual(lastCompletedAt);
    });
  });

  describe('togglePause', () => {
    it('should pause a habit', async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdHabit = await habitRepository.create(habitData);
      
      const pausedHabit = await habitRepository.togglePause(createdHabit.id, testUserId, true, 'Taking a break');

      expect(pausedHabit).toBeDefined();
      expect(pausedHabit!.isPaused).toBe(true);
      expect(pausedHabit!.pauseReason).toBe('Taking a break');
      expect(pausedHabit!.pausedAt).toBeDefined();
    });

    it('should unpause a habit', async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: true,
        pausedAt: new Date(),
        pauseReason: 'Taking a break',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdHabit = await habitRepository.create(habitData);
      
      const unpausedHabit = await habitRepository.togglePause(createdHabit.id, testUserId, false);

      expect(unpausedHabit).toBeDefined();
      expect(unpausedHabit!.isPaused).toBe(false);
      expect(unpausedHabit!.pauseReason).toBeNull();
      expect(unpausedHabit!.pausedAt).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a habit', async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdHabit = await habitRepository.create(habitData);
      
      const deleted = await habitRepository.delete(createdHabit.id, testUserId);
      expect(deleted).toBe(true);

      const foundHabit = await habitRepository.findById(createdHabit.id);
      expect(foundHabit).toBeNull();
    });
  });

  describe('Habit Completions', () => {
    let testHabitId: string;

    beforeEach(async () => {
      const habitData: NewHabit = {
        userId: testUserId,
        name: 'Daily Exercise',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdHabit = await habitRepository.create(habitData);
      testHabitId = createdHabit.id;
    });

    describe('createCompletion', () => {
      it('should create a habit completion', async () => {
        const completionData: NewHabitCompletion = {
          habitId: testHabitId,
          userId: testUserId,
          completedDate: '2024-01-15',
          completedAt: new Date(),
          streakAtCompletion: 1,
          xpAwarded: 15,
          bonusXPAwarded: 0,
          completionMethod: 'manual'
        };

        const completion = await habitRepository.createCompletion(completionData);

        expect(completion).toBeDefined();
        expect(completion.id).toBeDefined();
        expect(completion.habitId).toBe(testHabitId);
        expect(completion.userId).toBe(testUserId);
        expect(completion.completedDate).toBe('2024-01-15');
        expect(completion.streakAtCompletion).toBe(1);
      });
    });

    describe('findCompletionByDate', () => {
      it('should find completion by date', async () => {
        const completionData: NewHabitCompletion = {
          habitId: testHabitId,
          userId: testUserId,
          completedDate: '2024-01-15',
          completedAt: new Date(),
          streakAtCompletion: 1,
          xpAwarded: 15,
          bonusXPAwarded: 0,
          completionMethod: 'manual'
        };

        await habitRepository.createCompletion(completionData);
        
        const foundCompletion = await habitRepository.findCompletionByDate(testHabitId, testUserId, '2024-01-15');

        expect(foundCompletion).toBeDefined();
        expect(foundCompletion!.completedDate).toBe('2024-01-15');
      });

      it('should return null for non-existent completion', async () => {
        const completion = await habitRepository.findCompletionByDate(testHabitId, testUserId, '2024-01-15');
        expect(completion).toBeNull();
      });
    });

    describe('getCompletionsInRange', () => {
      it('should get completions in date range', async () => {
        const completion1: NewHabitCompletion = {
          habitId: testHabitId,
          userId: testUserId,
          completedDate: '2024-01-15',
          completedAt: new Date(),
          streakAtCompletion: 1,
          xpAwarded: 15,
          bonusXPAwarded: 0,
          completionMethod: 'manual'
        };

        const completion2: NewHabitCompletion = {
          habitId: testHabitId,
          userId: testUserId,
          completedDate: '2024-01-16',
          completedAt: new Date(),
          streakAtCompletion: 2,
          xpAwarded: 15,
          bonusXPAwarded: 5,
          completionMethod: 'manual'
        };

        const completion3: NewHabitCompletion = {
          habitId: testHabitId,
          userId: testUserId,
          completedDate: '2024-01-20',
          completedAt: new Date(),
          streakAtCompletion: 1,
          xpAwarded: 15,
          bonusXPAwarded: 0,
          completionMethod: 'manual'
        };

        await habitRepository.createCompletion(completion1);
        await habitRepository.createCompletion(completion2);
        await habitRepository.createCompletion(completion3);

        const completions = await habitRepository.getCompletionsInRange(
          testHabitId, 
          testUserId, 
          '2024-01-15', 
          '2024-01-17'
        );

        expect(completions).toHaveLength(2);
        expect(completions[0].completedDate).toBe('2024-01-15');
        expect(completions[1].completedDate).toBe('2024-01-16');
      });
    });

    describe('getCompletionCount', () => {
      it('should count completions in date range', async () => {
        const completion1: NewHabitCompletion = {
          habitId: testHabitId,
          userId: testUserId,
          completedDate: '2024-01-15',
          completedAt: new Date(),
          streakAtCompletion: 1,
          xpAwarded: 15,
          bonusXPAwarded: 0,
          completionMethod: 'manual'
        };

        const completion2: NewHabitCompletion = {
          habitId: testHabitId,
          userId: testUserId,
          completedDate: '2024-01-16',
          completedAt: new Date(),
          streakAtCompletion: 2,
          xpAwarded: 15,
          bonusXPAwarded: 5,
          completionMethod: 'manual'
        };

        await habitRepository.createCompletion(completion1);
        await habitRepository.createCompletion(completion2);

        const count = await habitRepository.getCompletionCount(
          testHabitId, 
          testUserId, 
          '2024-01-15', 
          '2024-01-17'
        );

        expect(count).toBe(2);
      });
    });
  });

  describe('getHabitStats', () => {
    it('should calculate habit statistics', async () => {
      const habit1Data: NewHabit = {
        userId: testUserId,
        name: 'Active Habit',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 5,
        longestStreak: 10,
        totalCompletions: 15,
        isActive: true,
        isPaused: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const habit2Data: NewHabit = {
        userId: testUserId,
        name: 'Paused Habit',
        frequency: 'daily',
        targetStreak: 30,
        xpPerCompletion: 15,
        currentStreak: 2,
        longestStreak: 8,
        totalCompletions: 10,
        isActive: true,
        isPaused: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await habitRepository.create(habit1Data);
      await habitRepository.create(habit2Data);

      const stats = await habitRepository.getHabitStats(testUserId);

      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1);
      expect(stats.paused).toBe(1);
      expect(stats.totalCompletions).toBe(25);
      expect(stats.longestOverallStreak).toBe(10);
    });
  });
});