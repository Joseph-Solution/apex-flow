import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TaskService } from '../services/TaskService';
import { ExperienceService } from '../services/ExperienceService';
import { UserRepository } from '../repositories/UserRepository';
import { TaskRepository } from '../repositories/TaskRepository';
import { db } from '../db/connection';
import { users, tasks } from '../db/schema';

describe('Task Completion and XP Rewards Integration', () => {
  let taskService: TaskService;
  let experienceService: ExperienceService;
  let userRepository: UserRepository;
  let taskRepository: TaskRepository;
  let testUserId: string;

  beforeEach(async () => {
    taskService = new TaskService();
    experienceService = new ExperienceService();
    userRepository = new UserRepository();
    taskRepository = new TaskRepository();

    // Create a test user
    const testUser = await userRepository.create({
      email: 'taskcompletion@example.com',
      username: 'taskcompletion',
      passwordHash: 'hashedpassword',
      firstName: 'Task',
      lastName: 'Completion',
      timezone: 'UTC'
    });
    testUserId = testUser.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(tasks);
    await db.delete(users);
  });

  describe('Task Completion with XP Rewards', () => {
    it('should complete task and award correct XP based on priority', async () => {
      // Create tasks with different priorities
      const lowPriorityTask = await taskService.createTask(testUserId, {
        title: 'Low Priority Task',
        priority: 'low'
      });

      const mediumPriorityTask = await taskService.createTask(testUserId, {
        title: 'Medium Priority Task',
        priority: 'medium'
      });

      const highPriorityTask = await taskService.createTask(testUserId, {
        title: 'High Priority Task',
        priority: 'high'
      });

      const urgentPriorityTask = await taskService.createTask(testUserId, {
        title: 'Urgent Priority Task',
        priority: 'urgent'
      });

      // Complete tasks and verify XP rewards
      const lowResult = await taskService.completeTask(lowPriorityTask.id, testUserId, {});
      expect(lowResult).toBeDefined();
      expect(lowResult!.xpAwarded).toBeGreaterThan(0);

      const mediumResult = await taskService.completeTask(mediumPriorityTask.id, testUserId, {});
      expect(mediumResult).toBeDefined();
      expect(mediumResult!.xpAwarded).toBeGreaterThan(lowResult!.xpAwarded);

      const highResult = await taskService.completeTask(highPriorityTask.id, testUserId, {});
      expect(highResult).toBeDefined();
      expect(highResult!.xpAwarded).toBeGreaterThan(mediumResult!.xpAwarded);

      const urgentResult = await taskService.completeTask(urgentPriorityTask.id, testUserId, {});
      expect(urgentResult).toBeDefined();
      expect(urgentResult!.xpAwarded).toBeGreaterThan(highResult!.xpAwarded);

      // Verify tasks are marked as completed
      expect(lowResult!.task.status).toBe('completed');
      expect(mediumResult!.task.status).toBe('completed');
      expect(highResult!.task.status).toBe('completed');
      expect(urgentResult!.task.status).toBe('completed');

      // Verify completion timestamps
      expect(lowResult!.task.completedAt).toBeDefined();
      expect(mediumResult!.task.completedAt).toBeDefined();
      expect(highResult!.task.completedAt).toBeDefined();
      expect(urgentResult!.task.completedAt).toBeDefined();
    });

    it('should award bonus XP for early completion', async () => {
      // Create task with future due date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days in future

      const task = await taskService.createTask(testUserId, {
        title: 'Task with Future Due Date',
        priority: 'medium',
        dueDate: futureDate.toISOString()
      });

      // Complete task early
      const result = await taskService.completeTask(task.id, testUserId, {
        completionNotes: 'Completed early!',
        actualDuration: 45
      });

      expect(result).toBeDefined();
      expect(result!.task.status).toBe('completed');
      expect(result!.task.completionNotes).toBe('Completed early!');
      expect(result!.task.actualDuration).toBe(45);
      
      // Should have bonus XP for early completion
      expect(result!.task.bonusXP).toBeGreaterThan(0);
      expect(result!.xpAwarded).toBeGreaterThan(result!.task.xpReward);
    });

    it('should not award bonus XP for overdue completion', async () => {
      // Create task with past due date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7); // 7 days ago

      const task = await taskService.createTask(testUserId, {
        title: 'Overdue Task',
        priority: 'medium',
        dueDate: pastDate.toISOString()
      });

      // Complete overdue task
      const result = await taskService.completeTask(task.id, testUserId, {
        completionNotes: 'Better late than never'
      });

      expect(result).toBeDefined();
      expect(result!.task.status).toBe('completed');
      expect(result!.task.completionNotes).toBe('Better late than never');
      
      // Should not have bonus XP for overdue completion
      expect(result!.task.bonusXP || 0).toBe(0);
      expect(result!.xpAwarded).toBe(result!.task.xpReward);
    });

    it('should prevent double completion of tasks', async () => {
      const task = await taskService.createTask(testUserId, {
        title: 'Task to Complete Once',
        priority: 'medium'
      });

      // Complete task first time
      const firstResult = await taskService.completeTask(task.id, testUserId, {});
      expect(firstResult).toBeDefined();
      expect(firstResult!.task.status).toBe('completed');

      // Try to complete again - should throw error
      await expect(taskService.completeTask(task.id, testUserId, {}))
        .rejects.toThrow('Task is already completed');
    });

    it('should track completion history and timestamps', async () => {
      const task = await taskService.createTask(testUserId, {
        title: 'Task with Completion Tracking',
        priority: 'high',
        estimatedDuration: 60
      });

      const beforeCompletion = new Date();
      
      const result = await taskService.completeTask(task.id, testUserId, {
        completionNotes: 'Task completed successfully with detailed notes',
        actualDuration: 45
      });

      const afterCompletion = new Date();

      expect(result).toBeDefined();
      expect(result!.task.completedAt).toBeDefined();
      
      const completedAt = new Date(result!.task.completedAt!);
      expect(completedAt.getTime()).toBeGreaterThanOrEqual(beforeCompletion.getTime());
      expect(completedAt.getTime()).toBeLessThanOrEqual(afterCompletion.getTime());
      
      expect(result!.task.completionNotes).toBe('Task completed successfully with detailed notes');
      expect(result!.task.actualDuration).toBe(45);
      expect(result!.task.estimatedDuration).toBe(60);
    });

    it('should update user XP and level progression', async () => {
      // Get initial user level info
      const initialLevelInfo = await experienceService.getUserLevelInfo(testUserId);
      expect(initialLevelInfo).toBeDefined();
      const initialTotalXP = initialLevelInfo!.totalXP;

      // Create and complete a high-value task
      const task = await taskService.createTask(testUserId, {
        title: 'High Value Task',
        priority: 'urgent'
      });

      const result = await taskService.completeTask(task.id, testUserId, {});
      expect(result).toBeDefined();

      // Check that user XP increased
      const finalLevelInfo = await experienceService.getUserLevelInfo(testUserId);
      expect(finalLevelInfo).toBeDefined();
      expect(finalLevelInfo!.totalXP).toBeGreaterThan(initialTotalXP);
      
      // XP increase should match the awarded amount
      const xpIncrease = finalLevelInfo!.totalXP - initialTotalXP;
      expect(xpIncrease).toBe(result!.xpAwarded);
    });

    it('should handle task completion validation', async () => {
      // Try to complete non-existent task
      const nonExistentResult = await taskService.completeTask(
        '00000000-0000-0000-0000-000000000000', 
        testUserId, 
        {}
      );
      expect(nonExistentResult).toBeNull();

      // Create task for different user
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        username: 'other',
        passwordHash: 'hashedpassword',
        firstName: 'Other',
        lastName: 'User',
        timezone: 'UTC'
      });

      const otherUserTask = await taskService.createTask(otherUser.id, {
        title: 'Other User Task',
        priority: 'medium'
      });

      // Try to complete other user's task
      const unauthorizedResult = await taskService.completeTask(
        otherUserTask.id, 
        testUserId, 
        {}
      );
      expect(unauthorizedResult).toBeNull();
    });
  });
});