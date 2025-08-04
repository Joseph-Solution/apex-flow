import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { db } from '../db/connection';
import { users, tasks } from '../db/schema';
import { UserRepository } from '../repositories/UserRepository';
import { JwtService } from '../services/JwtService';
import taskRoutes from '../routes/tasks';
import { authenticate } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRoutes);

describe('Task Routes Integration Tests', () => {
  let userRepository: UserRepository;
  let jwtService: JwtService;
  let testUserId: string;
  let authToken: string;

  beforeEach(async () => {
    userRepository = new UserRepository();
    jwtService = new JwtService();

    // Create a test user
    const testUser = await userRepository.create({
      email: 'taskroutes@example.com',
      username: 'taskroutes',
      passwordHash: 'hashedpassword',
      firstName: 'Task',
      lastName: 'Routes',
      timezone: 'UTC'
    });
    testUserId = testUser.id;

    // Generate auth token
    const tokenPair = jwtService.generateTokenPair(testUser);
    authToken = tokenPair.accessToken;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(tasks);
    await db.delete(users);
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'high',
        dueDate: '2024-12-31T23:59:59.000Z',
        tags: ['test', 'api']
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: 'Test Task',
        description: 'Test Description',
        priority: 'high',
        status: 'pending',
        xpReward: 50, // High priority = 50 XP
        tags: ['test', 'api']
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.userId).toBe(testUserId);
    });

    it('should return 400 for invalid task data', async () => {
      const invalidTaskData = {
        title: '', // Empty title should fail validation
        priority: 'invalid_priority'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTaskData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without authentication', async () => {
      const taskData = {
        title: 'Test Task',
        priority: 'medium'
      };

      await request(app)
        .post('/api/tasks')
        .send(taskData)
        .expect(401);
    });
  });

  describe('GET /api/tasks', () => {
    beforeEach(async () => {
      // Create test tasks
      const testTasks = [
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
          title: 'Completed Task',
          priority: 'medium' as const,
          status: 'completed' as const,
          xpReward: 25,
          tags: ['done'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Low Priority Task',
          priority: 'low' as const,
          status: 'pending' as const,
          xpReward: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const task of testTasks) {
        await db.insert(tasks).values(task);
      }
    });

    it('should return paginated tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(3);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(20);
      expect(response.body.data.totalPages).toBe(1);
    });

    it('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .query({
          filter: JSON.stringify({ status: 'pending' })
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(2);
      expect(response.body.data.tasks.every((task: any) => task.status === 'pending')).toBe(true);
    });

    it('should sort tasks by priority', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .query({
          sort: JSON.stringify({ field: 'priority', direction: 'asc' })
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const tasks = response.body.data.tasks;
      expect(tasks[0].priority).toBe('high'); // Urgent (1) -> High (2) -> Medium (3) -> Low (4)
      expect(tasks[1].priority).toBe('medium');
      expect(tasks[2].priority).toBe('low');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(2);
      expect(response.body.data.totalPages).toBe(2);
    });
  });

  describe('GET /api/tasks/:id', () => {
    let testTaskId: string;

    beforeEach(async () => {
      const [task] = await db.insert(tasks).values({
        userId: testUserId,
        title: 'Test Task',
        priority: 'medium',
        status: 'pending',
        xpReward: 25,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      testTaskId = task.id;
    });

    it('should return task by ID', async () => {
      const response = await request(app)
        .get(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testTaskId);
      expect(response.body.data.title).toBe('Test Task');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .get('/api/tasks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/tasks/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/tasks/:id', () => {
    let testTaskId: string;

    beforeEach(async () => {
      const [task] = await db.insert(tasks).values({
        userId: testUserId,
        title: 'Original Task',
        priority: 'low',
        status: 'pending',
        xpReward: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      testTaskId = task.id;
    });

    it('should update task', async () => {
      const updates = {
        title: 'Updated Task',
        priority: 'high',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Task');
      expect(response.body.data.priority).toBe('high');
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.xpReward).toBe(50); // High priority = 50 XP
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .put('/api/tasks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    let testTaskId: string;

    beforeEach(async () => {
      const [task] = await db.insert(tasks).values({
        userId: testUserId,
        title: 'Task to Delete',
        priority: 'medium',
        status: 'pending',
        xpReward: 25,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      testTaskId = task.id;
    });

    it('should delete task', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task deleted successfully');

      // Verify task is deleted
      const getResponse = await request(app)
        .get(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .delete('/api/tasks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/tasks/:id/complete', () => {
    let testTaskId: string;

    beforeEach(async () => {
      const [task] = await db.insert(tasks).values({
        userId: testUserId,
        title: 'Task to Complete',
        priority: 'medium',
        status: 'pending',
        xpReward: 25,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      testTaskId = task.id;
    });

    it('should complete task and award XP', async () => {
      const completionData = {
        completionNotes: 'Task completed successfully',
        actualDuration: 30
      };

      const response = await request(app)
        .patch(`/api/tasks/${testTaskId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(completionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.task.status).toBe('completed');
      expect(response.body.data.task.completedAt).toBeDefined();
      expect(response.body.data.task.completionNotes).toBe('Task completed successfully');
      expect(response.body.data.task.actualDuration).toBe(30);
      expect(response.body.data.xpAwarded).toBe(25);
    });

    it('should return 400 if task already completed', async () => {
      // First completion
      await request(app)
        .patch(`/api/tasks/${testTaskId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      // Second completion attempt
      const response = await request(app)
        .patch(`/api/tasks/${testTaskId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TASK_ALREADY_COMPLETED');
    });
  });

  describe('GET /api/tasks/stats', () => {
    beforeEach(async () => {
      const testTasks = [
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
        }
      ];

      for (const task of testTasks) {
        await db.insert(tasks).values(task);
      }
    });

    it('should return task statistics', async () => {
      const response = await request(app)
        .get('/api/tasks/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total: 3,
        completed: 2,
        pending: 1,
        inProgress: 0,
        overdue: 0,
        completionRate: expect.any(Number)
      });
    });
  });

  describe('GET /api/tasks/overdue', () => {
    beforeEach(async () => {
      const testTasks = [
        {
          userId: testUserId,
          title: 'Overdue Task',
          priority: 'high' as const,
          status: 'pending' as const,
          dueDate: new Date('2023-01-01'),
          xpReward: 50,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testUserId,
          title: 'Future Task',
          priority: 'medium' as const,
          status: 'pending' as const,
          dueDate: new Date('2025-12-31'),
          xpReward: 25,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const task of testTasks) {
        await db.insert(tasks).values(task);
      }
    });

    it('should return overdue tasks', async () => {
      const response = await request(app)
        .get('/api/tasks/overdue')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Overdue Task');
    });
  });

  describe('GET /api/tasks/status/:status', () => {
    beforeEach(async () => {
      const testTasks = [
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

      for (const task of testTasks) {
        await db.insert(tasks).values(task);
      }
    });

    it('should return tasks by status', async () => {
      const response = await request(app)
        .get('/api/tasks/status/pending')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((task: any) => task.status === 'pending')).toBe(true);
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .get('/api/tasks/status/invalid_status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});