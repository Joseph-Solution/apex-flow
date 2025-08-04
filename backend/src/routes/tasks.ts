import { Router, Request, Response } from 'express';
import { TaskService } from '../services/TaskService';
import { authenticate } from '../middleware/auth';
import { 
  createTaskSchema, 
  updateTaskRequestSchema, 
  taskQuerySchema,
  completeTaskSchema
} from '../models/Task';
import { z } from 'zod';

const router = Router();
const taskService = new TaskService();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * GET /api/tasks
 * Get tasks for the authenticated user with filtering, sorting, and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Parse and validate query parameters
    const queryResult = taskQuerySchema.safeParse({
      ...req.query,
      filter: req.query.filter ? JSON.parse(req.query.filter as string) : undefined,
      sort: req.query.sort ? JSON.parse(req.query.sort as string) : undefined
    });

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: queryResult.error.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    const result = await taskService.getTasks(userId, queryResult.data);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch tasks',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Validate request body
    const validationResult = createTaskSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid task data',
          details: validationResult.error.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    const task = await taskService.createTask(userId, validationResult.data);

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create task',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/tasks/stats
 * Get task statistics for the authenticated user
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await taskService.getTaskStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching task stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch task statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/tasks/overdue
 * Get overdue tasks for the authenticated user
 */
router.get('/overdue', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tasks = await taskService.getOverdueTasks(userId);

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch overdue tasks',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get a specific task by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const uuidResult = uuidSchema.safeParse(taskId);
    if (!uuidResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid task ID format',
          timestamp: new Date().toISOString()
        }
      });
    }

    const task = await taskService.getTaskById(taskId, userId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch task',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/tasks/:id
 * Update a task
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const uuidResult = uuidSchema.safeParse(taskId);
    if (!uuidResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid task ID format',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate request body
    const validationResult = updateTaskRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid task data',
          details: validationResult.error.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    const task = await taskService.updateTask(taskId, userId, validationResult.data);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update task',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const uuidResult = uuidSchema.safeParse(taskId);
    if (!uuidResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid task ID format',
          timestamp: new Date().toISOString()
        }
      });
    }

    const deleted = await taskService.deleteTask(taskId, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete task',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PATCH /api/tasks/:id/complete
 * Mark a task as completed
 */
router.patch('/:id/complete', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const uuidResult = uuidSchema.safeParse(taskId);
    if (!uuidResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid task ID format',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate request body
    const validationResult = completeTaskSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid completion data',
          details: validationResult.error.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

    const result = await taskService.completeTask(taskId, userId, validationResult.data);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Task is already completed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TASK_ALREADY_COMPLETED',
          message: 'Task is already completed',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.error('Error completing task:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete task',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/tasks/status/:status
 * Get tasks by status
 */
router.get('/status/:status', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = req.params.status;

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status value',
          timestamp: new Date().toISOString()
        }
      });
    }

    const tasks = await taskService.getTasksByStatus(userId, status);

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching tasks by status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch tasks by status',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;