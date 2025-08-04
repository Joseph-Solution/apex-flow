import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TaskRepository } from '../repositories/TaskRepository';
import { UserRepository } from '../repositories/UserRepository';
import { db } from '../db/connection';
import { tasks, users } from '../db/schema';
import { NewTask, Task } from '../models/Task';

describe('TaskRepository', () => {
  let taskRepository: TaskRepository;
  let userRepository: UserRepository;
  let testUserId: string;

  beforeEach(async () => {
    taskRepository = new TaskRepository();
    userRepository = new UserRepository();

    // Create a test user
    const testUser = await userRepository.create({
      email: 'tasktest@example.com',
      username: 'tasktest',
      passwordHash: 'hashedpassword',
      firstName: 'Task',
      lastName: 'Test',
      timezone: 'UTC'
    });
    testUserId = testUser.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(tasks);
    await db.delete(users);
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const taskData: NewTask = {
        userId: testUserId,
        title: 'Test Task',
        description: 'Test Description',
        priority: 'high',
        status: 'pending',
        xpReward: 50,
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const task = await taskRepository.create(taskData);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('pending');
      expect(task.xpReward).toBe(50);
      expect(task.tags).toEqual(['test']);
    });

    it('should create a task with due date', async () => {
      const dueDate = new Date('2024-12-31');
      const taskData: NewTask = {
        userId: testUserId,
        title: 'Task with Due Date',
        priority: 'medium',
        status: 'pending',
        dueDate,
        xpReward: 25,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const task = await taskRepository.create(taskData);

      expect(task.dueDate).toEqual(dueDate);
    });
  });

  describe('findById', () => {
    it('should find a task by ID', async () => {
      const taskData: NewTask = {
        userId: testUserId,
        title: 'Findable Task',
        priority: 'low',
        status: 'pending',
        xpReward: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdTask = await taskRepository.create(taskData);
      const foundTask = await taskRepository.findById(createdTask.id);

      expect(foundTask).toBeDefined();
      expect(foundTask!.id).toBe(createdTask.id);
      expect(foundTask!.title).toBe('Findable Task');
    });

    it('should return null for non-existent task', async () => {
      const foundTask = await taskRepository.findById('00000000-0000-0000-0000-000000000000');
      expect(foundTask).toBeNull();
    });
  });

  describe('findByIdAndUserId', () => {
    it('should find a task by ID and user ID', async () => {
      const taskData: NewTask = {
        userId: testUserId,
        title: 'User Task',
        priority: 'medium',
        status: 'pending',
        xpReward: 25,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdTask = await taskRepository.create(taskData);
      const foundTask = await taskRepository.findByIdAndUserId(createdTask.id, testUserId);

      expect(foundTask).toBeDefined();
      expect(foundTask!.id).toBe(createdTask.id);
      expect(foundTask!.userId).toBe(testUserId);
    });

    it('should return null for task belonging to different user', async () => {
      const taskData: NewTask = {
        userId: testUserId,
        title: 'User Task',
        priority: 'medium',
        status: 'pending',
        xpReward: 25,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdTask = await taskRepository.create(taskData);
      const foundTask = await taskRepository.findByIdAndUserId(createdTask.id, '00000000-0000-0000-0000-000000000000');

      expect(foundTask).toBeNull();
    });
  });

  describe('findByUserId', () => {
    beforeEach(async () => {
      // Create test tasks
      const tasks = [
        {
          userId: testUserId,
          title: 'High Priority Task',
          priority: 'high' as const,
          status: 'pending' as const,
          dueDate: new Date('2024-12-31'),
          xpReward: 50,
          tags: ['urgent'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Low Priority Task',
          priority: 'low' as const,
          status: 'completed' as const,
          xpReward: 10,
          tags: ['easy'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Overdue Task',
          priority: 'medium' as const,
          status: 'pending' as const,
          dueDate: new Date('2023-01-01'),
          xpReward: 25,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const task of tasks) {
        await taskRepository.create(task);
      }
    });

    it('should return all tasks for a user', async () => {
      const result = await taskRepository.findByUserId(testUserId);

      expect(result.tasks).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter tasks by status', async () => {
      const result = await taskRepository.findByUserId(testUserId, {
        filter: { status: 'pending' }
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every(task => task.status === 'pending')).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const result = await taskRepository.findByUserId(testUserId, {
        filter: { priority: 'high' }
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].priority).toBe('high');
    });

    it('should filter overdue tasks', async () => {
      const result = await taskRepository.findByUserId(testUserId, {
        filter: { isOverdue: true }
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe('Overdue Task');
    });

    it('should sort tasks by priority', async () => {
      const result = await taskRepository.findByUserId(testUserId, {
        sort: { field: 'priority', direction: 'asc' }
      });

      expect(result.tasks).toHaveLength(3);
      // Should be ordered: urgent (1), high (2), medium (3), low (4)
      expect(result.tasks[0].priority).toBe('high');
      expect(result.tasks[1].priority).toBe('medium');
      expect(result.tasks[2].priority).toBe('low');
    });

    it('should paginate results', async () => {
      const result = await taskRepository.findByUserId(testUserId, {
        page: 1,
        limit: 2
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const taskData: NewTask = {
        userId: testUserId,
        title: 'Original Title',
        priority: 'low',
        status: 'pending',
        xpReward: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdTask = await taskRepository.create(taskData);
      const updatedTask = await taskRepository.update(createdTask.id, testUserId, {
        title: 'Updated Title',
        priority: 'high'
      });

      expect(updatedTask).toBeDefined();
      expect(updatedTask!.title).toBe('Updated Title');
      expect(updatedTask!.priority).toBe('high');
    });

    it('should return null when updating non-existent task', async () => {
      const updatedTask = await taskRepository.update('00000000-0000-0000-0000-000000000000', testUserId, {
        title: 'Updated Title'
      });

      expect(updatedTask).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a task', async () => {
      const taskData: NewTask = {
        userId: testUserId,
        title: 'Task to Delete',
        priority: 'medium',
        status: 'pending',
        xpReward: 25,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdTask = await taskRepository.create(taskData);
      const deleted = await taskRepository.delete(createdTask.id, testUserId);

      expect(deleted).toBe(true);

      const foundTask = await taskRepository.findById(createdTask.id);
      expect(foundTask).toBeNull();
    });

    it('should return false when deleting non-existent task', async () => {
      const deleted = await taskRepository.delete('00000000-0000-0000-0000-000000000000', testUserId);
      expect(deleted).toBe(false);
    });
  });

  describe('markCompleted', () => {
    it('should mark a task as completed', async () => {
      const taskData: NewTask = {
        userId: testUserId,
        title: 'Task to Complete',
        priority: 'medium',
        status: 'pending',
        xpReward: 25,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdTask = await taskRepository.create(taskData);
      const completedTask = await taskRepository.markCompleted(createdTask.id, testUserId, {
        completionNotes: 'Task completed successfully',
        actualDuration: 30
      });

      expect(completedTask).toBeDefined();
      expect(completedTask!.status).toBe('completed');
      expect(completedTask!.completedAt).toBeDefined();
      expect(completedTask!.completionNotes).toBe('Task completed successfully');
      expect(completedTask!.actualDuration).toBe(30);
    });
  });

  describe('getTaskStats', () => {
    beforeEach(async () => {
      const tasks = [
        {
          userId: testUserId,
          title: 'Completed Task 1',
          priority: 'medium' as const,
          status: 'completed' as const,
          xpReward: 25,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Completed Task 2',
          priority: 'high' as const,
          status: 'completed' as const,
          xpReward: 50,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Pending Task',
          priority: 'low' as const,
          status: 'pending' as const,
          xpReward: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'In Progress Task',
          priority: 'medium' as const,
          status: 'in_progress' as const,
          xpReward: 25,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Overdue Task',
          priority: 'high' as const,
          status: 'pending' as const,
          dueDate: new Date('2023-01-01'),
          xpReward: 50,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const task of tasks) {
        await taskRepository.create(task);
      }
    });

    it('should return correct task statistics', async () => {
      const stats = await taskRepository.getTaskStats(testUserId);

      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.overdue).toBe(1);
      expect(stats.completionRate).toBe(40); // 2/5 * 100
    });
  });

  describe('getOverdueTasks', () => {
    beforeEach(async () => {
      const tasks = [
        {
          userId: testUserId,
          title: 'Overdue Task 1',
          priority: 'high' as const,
          status: 'pending' as const,
          dueDate: new Date('2023-01-01'),
          xpReward: 50,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Overdue Task 2',
          priority: 'medium' as const,
          status: 'in_progress' as const,
          dueDate: new Date('2023-06-01'),
          xpReward: 25,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Future Task',
          priority: 'low' as const,
          status: 'pending' as const,
          dueDate: new Date('2025-12-31'),
          xpReward: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Completed Overdue Task',
          priority: 'high' as const,
          status: 'completed' as const,
          dueDate: new Date('2023-01-01'),
          xpReward: 50,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const task of tasks) {
        await taskRepository.create(task);
      }
    });

    it('should return only overdue pending/in-progress tasks', async () => {
      const overdueTasks = await taskRepository.getOverdueTasks(testUserId);

      expect(overdueTasks).toHaveLength(2);
      expect(overdueTasks.every(task => 
        (task.status === 'pending' || task.status === 'in_progress') &&
        task.dueDate && new Date(task.dueDate) < new Date()
      )).toBe(true);
    });
  });

  describe('getTasksByStatus', () => {
    beforeEach(async () => {
      const tasks = [
        {
          userId: testUserId,
          title: 'Pending Task 1',
          priority: 'medium' as const,
          status: 'pending' as const,
          xpReward: 25,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Pending Task 2',
          priority: 'high' as const,
          status: 'pending' as const,
          xpReward: 50,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Completed Task',
          priority: 'low' as const,
          status: 'completed' as const,
          xpReward: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const task of tasks) {
        await taskRepository.create(task);
      }
    });

    it('should return tasks with specified status', async () => {
      const pendingTasks = await taskRepository.getTasksByStatus(testUserId, 'pending');

      expect(pendingTasks).toHaveLength(2);
      expect(pendingTasks.every(task => task.status === 'pending')).toBe(true);
    });

    it('should return empty array for status with no tasks', async () => {
      const inProgressTasks = await taskRepository.getTasksByStatus(testUserId, 'in_progress');

      expect(inProgressTasks).toHaveLength(0);
    });
  });
});