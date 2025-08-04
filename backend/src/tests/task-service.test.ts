import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskService } from '../services/TaskService';
import { TaskRepository } from '../repositories/TaskRepository';
import { ExperienceService } from '../services/ExperienceService';
import { CreateTaskRequest, UpdateTaskRequest, TaskQuery } from '../models/Task';

// Mock the dependencies
jest.mock('../repositories/TaskRepository');
jest.mock('../services/ExperienceService');

const MockedTaskRepository = TaskRepository as jest.MockedClass<typeof TaskRepository>;
const MockedExperienceService = ExperienceService as jest.MockedClass<typeof ExperienceService>;

describe('TaskService', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<TaskRepository>;
  let mockExperienceService: jest.Mocked<ExperienceService>;

  const testUserId = 'test-user-id';
  const testTaskId = 'test-task-id';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked instances
    mockTaskRepository = new MockedTaskRepository() as jest.Mocked<TaskRepository>;
    mockExperienceService = new MockedExperienceService() as jest.Mocked<ExperienceService>;

    // Create service instance
    taskService = new TaskService();

    // Replace the private instances with mocks
    (taskService as any).taskRepository = mockTaskRepository;
    (taskService as any).experienceService = mockExperienceService;
  });

  describe('createTask', () => {
    it('should create a task with correct XP reward', async () => {
      const taskData: CreateTaskRequest = {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'high',
        dueDate: new Date('2024-12-31'),
        tags: ['test']
      };

      const expectedTask = {
        id: testTaskId,
        userId: testUserId,
        ...taskData,
        status: 'pending',
        xpReward: 50, // High priority = 50 XP
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockTaskRepository.create.mockResolvedValue(expectedTask as any);

      const result = await taskService.createTask(testUserId, taskData);

      expect(mockTaskRepository.create).toHaveBeenCalledWith({
        userId: testUserId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        status: 'pending',
        dueDate: new Date(taskData.dueDate!),
        estimatedDuration: undefined,
        xpReward: 50,
        tags: taskData.tags,
        category: undefined,
        isRecurring: false,
        recurringConfig: undefined,
        parentTaskId: undefined,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
      expect(result).toEqual(expectedTask);
    });

    it('should calculate correct XP rewards for different priorities', async () => {
      const priorities = [
        { priority: 'low', expectedXP: 10 },
        { priority: 'medium', expectedXP: 25 },
        { priority: 'high', expectedXP: 50 },
        { priority: 'urgent', expectedXP: 100 }
      ];

      for (const { priority, expectedXP } of priorities) {
        const taskData: CreateTaskRequest = {
          title: 'Test Task',
          priority: priority as any
        };

        mockTaskRepository.create.mockResolvedValue({
          id: testTaskId,
          userId: testUserId,
          ...taskData,
          xpReward: expectedXP
        } as any);

        await taskService.createTask(testUserId, taskData);

        expect(mockTaskRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            xpReward: expectedXP
          })
        );
      }
    });
  });

  describe('getTaskById', () => {
    it('should return task when found', async () => {
      const expectedTask = {
        id: testTaskId,
        userId: testUserId,
        title: 'Test Task',
        status: 'pending'
      };

      mockTaskRepository.findByIdAndUserId.mockResolvedValue(expectedTask as any);

      const result = await taskService.getTaskById(testTaskId, testUserId);

      expect(mockTaskRepository.findByIdAndUserId).toHaveBeenCalledWith(testTaskId, testUserId);
      expect(result).toEqual(expectedTask);
    });

    it('should return null when task not found', async () => {
      mockTaskRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await taskService.getTaskById(testTaskId, testUserId);

      expect(result).toBeNull();
    });
  });

  describe('getTasks', () => {
    it('should return paginated tasks with metadata', async () => {
      const query: TaskQuery = {
        page: 1,
        limit: 10,
        sort: { field: 'createdAt', direction: 'desc' },
        filter: { status: 'pending' }
      };

      const mockTasks = [
        { id: '1', title: 'Task 1' },
        { id: '2', title: 'Task 2' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 2
      });

      const result = await taskService.getTasks(testUserId, query);

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: query.filter,
        sort: query.sort,
        page: query.page,
        limit: query.limit
      });

      expect(result).toEqual({
        tasks: mockTasks,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      });
    });

    it('should calculate correct total pages', async () => {
      const query: TaskQuery = {
        page: 1,
        limit: 5
      };

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: [] as any,
        total: 12
      });

      const result = await taskService.getTasks(testUserId, query);

      expect(result.totalPages).toBe(3); // Math.ceil(12/5)
    });
  });

  describe('updateTask', () => {
    it('should update task and recalculate XP if priority changed', async () => {
      const existingTask = {
        id: testTaskId,
        userId: testUserId,
        title: 'Original Task',
        priority: 'low',
        xpReward: 10
      };

      const updates: UpdateTaskRequest = {
        title: 'Updated Task',
        priority: 'high'
      };

      const updatedTask = {
        ...existingTask,
        ...updates,
        xpReward: 50 // High priority = 50 XP
      };

      mockTaskRepository.findByIdAndUserId.mockResolvedValue(existingTask as any);
      mockTaskRepository.update.mockResolvedValue(updatedTask as any);

      const result = await taskService.updateTask(testTaskId, testUserId, updates);

      expect(mockTaskRepository.update).toHaveBeenCalledWith(testTaskId, testUserId, {
        ...updates,
        xpReward: 50
      });
      expect(result).toEqual(updatedTask);
    });

    it('should not recalculate XP if priority unchanged', async () => {
      const existingTask = {
        id: testTaskId,
        userId: testUserId,
        title: 'Original Task',
        priority: 'medium',
        xpReward: 25
      };

      const updates: UpdateTaskRequest = {
        title: 'Updated Task'
      };

      mockTaskRepository.findByIdAndUserId.mockResolvedValue(existingTask as any);
      mockTaskRepository.update.mockResolvedValue({ ...existingTask, ...updates } as any);

      await taskService.updateTask(testTaskId, testUserId, updates);

      expect(mockTaskRepository.update).toHaveBeenCalledWith(testTaskId, testUserId, updates);
    });

    it('should return null if task not found', async () => {
      mockTaskRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await taskService.updateTask(testTaskId, testUserId, { title: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      mockTaskRepository.delete.mockResolvedValue(true);

      const result = await taskService.deleteTask(testTaskId, testUserId);

      expect(mockTaskRepository.delete).toHaveBeenCalledWith(testTaskId, testUserId);
      expect(result).toBe(true);
    });

    it('should return false if task not found', async () => {
      mockTaskRepository.delete.mockResolvedValue(false);

      const result = await taskService.deleteTask(testTaskId, testUserId);

      expect(result).toBe(false);
    });
  });

  describe('completeTask', () => {
    it('should complete task and award XP', async () => {
      const existingTask = {
        id: testTaskId,
        userId: testUserId,
        title: 'Test Task',
        status: 'pending',
        priority: 'medium',
        xpReward: 25,
        dueDate: new Date('2024-12-31')
      };

      const completedTask = {
        ...existingTask,
        status: 'completed',
        completedAt: new Date(),
        bonusXP: 0
      };

      const completionData = {
        completionNotes: 'Task completed',
        actualDuration: 30
      };

      mockTaskRepository.findByIdAndUserId.mockResolvedValue(existingTask as any);
      mockTaskRepository.markCompleted.mockResolvedValue(completedTask as any);
      mockExperienceService.awardTaskXP.mockResolvedValue({
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
          isMaxLevel: false
        }
      });

      const result = await taskService.completeTask(testTaskId, testUserId, completionData);

      expect(mockTaskRepository.markCompleted).toHaveBeenCalledWith(testTaskId, testUserId, completionData);
      expect(mockExperienceService.awardTaskXP).toHaveBeenCalledWith(
        testUserId,
        'medium',
        'Test Task',
        {
          taskId: testTaskId,
          bonusXP: 0,
          completedEarly: false
        }
      );
      expect(result).toEqual({
        task: completedTask,
        xpAwarded: 25
      });
    });

    it('should calculate bonus XP for early completion', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days in future

      const existingTask = {
        id: testTaskId,
        userId: testUserId,
        title: 'Test Task',
        status: 'pending',
        priority: 'medium',
        xpReward: 50,
        dueDate: futureDate
      };

      const completedTask = {
        ...existingTask,
        status: 'completed',
        completedAt: new Date(),
        bonusXP: 0
      };

      mockTaskRepository.findByIdAndUserId.mockResolvedValue(existingTask as any);
      mockTaskRepository.markCompleted.mockResolvedValue(completedTask as any);
      mockTaskRepository.update.mockResolvedValue({ ...completedTask, bonusXP: 25 } as any);
      mockExperienceService.awardTaskXP.mockResolvedValue({
        xpAwarded: 75,
        previousLevel: 1,
        newLevel: 2,
        leveledUp: true,
        newLevelInfo: {
          level: 2,
          currentXP: 75,
          nextLevelXP: 120,
          totalXP: 175,
          progressToNext: 62,
          isMaxLevel: false
        }
      });

      const result = await taskService.completeTask(testTaskId, testUserId, {});

      // Should award bonus XP (up to 50% of base XP)
      expect(mockTaskRepository.update).toHaveBeenCalledWith(testTaskId, testUserId, {
        bonusXP: expect.any(Number)
      });
      expect(mockExperienceService.awardTaskXP).toHaveBeenCalledWith(
        testUserId,
        'medium',
        'Test Task',
        expect.objectContaining({
          bonusXP: expect.any(Number),
          completedEarly: true
        })
      );
    });

    it('should throw error if task already completed', async () => {
      const completedTask = {
        id: testTaskId,
        userId: testUserId,
        status: 'completed'
      };

      mockTaskRepository.findByIdAndUserId.mockResolvedValue(completedTask as any);

      await expect(taskService.completeTask(testTaskId, testUserId, {}))
        .rejects.toThrow('Task is already completed');
    });

    it('should return null if task not found', async () => {
      mockTaskRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await taskService.completeTask(testTaskId, testUserId, {});

      expect(result).toBeNull();
    });
  });

  describe('getTaskStats', () => {
    it('should return task statistics', async () => {
      const expectedStats = {
        total: 10,
        completed: 6,
        pending: 3,
        inProgress: 1,
        overdue: 2,
        completionRate: 60
      };

      mockTaskRepository.getTaskStats.mockResolvedValue(expectedStats);

      const result = await taskService.getTaskStats(testUserId);

      expect(mockTaskRepository.getTaskStats).toHaveBeenCalledWith(testUserId);
      expect(result).toEqual(expectedStats);
    });
  });

  describe('getOverdueTasks', () => {
    it('should return overdue tasks', async () => {
      const overdueTasks = [
        { id: '1', title: 'Overdue Task 1', status: 'pending' },
        { id: '2', title: 'Overdue Task 2', status: 'in_progress' }
      ];

      mockTaskRepository.getOverdueTasks.mockResolvedValue(overdueTasks as any);

      const result = await taskService.getOverdueTasks(testUserId);

      expect(mockTaskRepository.getOverdueTasks).toHaveBeenCalledWith(testUserId);
      expect(result).toEqual(overdueTasks);
    });
  });

  describe('getTasksByStatus', () => {
    it('should return tasks by status', async () => {
      const pendingTasks = [
        { id: '1', title: 'Pending Task 1', status: 'pending' },
        { id: '2', title: 'Pending Task 2', status: 'pending' }
      ];

      mockTaskRepository.getTasksByStatus.mockResolvedValue(pendingTasks as any);

      const result = await taskService.getTasksByStatus(testUserId, 'pending');

      expect(mockTaskRepository.getTasksByStatus).toHaveBeenCalledWith(testUserId, 'pending');
      expect(result).toEqual(pendingTasks);
    });
  });

  describe('validateTaskOwnership', () => {
    it('should return true if user owns task', async () => {
      mockTaskRepository.findByIdAndUserId.mockResolvedValue({ id: testTaskId } as any);

      const result = await taskService.validateTaskOwnership(testTaskId, testUserId);

      expect(result).toBe(true);
    });

    it('should return false if user does not own task', async () => {
      mockTaskRepository.findByIdAndUserId.mockResolvedValue(null);

      const result = await taskService.validateTaskOwnership(testTaskId, testUserId);

      expect(result).toBe(false);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should update multiple tasks status', async () => {
      const taskIds = ['task1', 'task2', 'task3'];
      const updatedTasks = [
        { id: 'task1', status: 'completed' },
        { id: 'task2', status: 'completed' }
      ];

      mockTaskRepository.update
        .mockResolvedValueOnce(updatedTasks[0] as any)
        .mockResolvedValueOnce(updatedTasks[1] as any)
        .mockResolvedValueOnce(null); // Third task not found

      const result = await taskService.bulkUpdateStatus(taskIds, testUserId, 'completed');

      expect(mockTaskRepository.update).toHaveBeenCalledTimes(3);
      expect(result).toEqual(updatedTasks);
    });
  });

  describe('getCompletionRate', () => {
    it('should calculate completion rate for specified period', async () => {
      const mockTasks = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'pending' },
        { status: 'in_progress' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 4
      });

      const result = await taskService.getCompletionRate(testUserId, 30);

      expect(result).toBe(50); // 2 completed out of 4 total = 50%
    });

    it('should return 0 if no tasks found', async () => {
      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: [],
        total: 0
      });

      const result = await taskService.getCompletionRate(testUserId, 30);

      expect(result).toBe(0);
    });
  });
});