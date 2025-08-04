import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { HabitService } from '../services/HabitService';
import { authenticate } from '../middleware/auth';
import { 
  createHabitSchema, 
  updateHabitRequestSchema, 
  habitQuerySchema,
  completeHabitSchema,
  habitAnalyticsSchema
} from '../models/Habit';

const router = Router();
const habitService = new HabitService();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * GET /api/habits
 * Get all habits for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const query = habitQuerySchema.parse(req.query);
    
    const result = await habitService.getHabits(userId, query);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching habits:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch habits'
      }
    });
  }
});

/**
 * GET /api/habits/:id
 * Get a specific habit by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const habitId = req.params.id;
    
    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HABIT_ID',
          message: 'Habit ID is required'
        }
      });
    }
    
    const habit = await habitService.getHabitById(habitId, userId);
    
    if (!habit) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'HABIT_NOT_FOUND',
          message: 'Habit not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: habit
    });
  } catch (error) {
    console.error('Error fetching habit:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch habit'
      }
    });
  }
});

/**
 * POST /api/habits
 * Create a new habit
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const habitData = createHabitSchema.parse(req.body);
    
    const habit = await habitService.createHabit(userId, habitData);
    
    res.status(201).json({
      success: true,
      data: habit
    });
  } catch (error) {
    console.error('Error creating habit:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid habit data',
          details: error.errors
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create habit'
      }
    });
  }
});

/**
 * PUT /api/habits/:id
 * Update a habit
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const habitId = req.params.id;
    const updates = updateHabitRequestSchema.parse(req.body);
    
    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HABIT_ID',
          message: 'Habit ID is required'
        }
      });
    }
    
    const habit = await habitService.updateHabit(habitId, userId, updates);
    
    if (!habit) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'HABIT_NOT_FOUND',
          message: 'Habit not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: habit
    });
  } catch (error) {
    console.error('Error updating habit:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update data',
          details: error.errors
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update habit'
      }
    });
  }
});

/**
 * DELETE /api/habits/:id
 * Delete a habit
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const habitId = req.params.id;
    
    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HABIT_ID',
          message: 'Habit ID is required'
        }
      });
    }
    
    const deleted = await habitService.deleteHabit(habitId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'HABIT_NOT_FOUND',
          message: 'Habit not found'
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Habit deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting habit:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete habit'
      }
    });
  }
});

/**
 * PATCH /api/habits/:id/complete
 * Mark a habit as completed for a specific date
 */
router.patch('/:id/complete', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const habitId = req.params.id;
    const completionData = completeHabitSchema.parse(req.body);
    
    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HABIT_ID',
          message: 'Habit ID is required'
        }
      });
    }
    
    const result = await habitService.completeHabit(habitId, userId, completionData);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'HABIT_NOT_FOUND',
          message: 'Habit not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error completing habit:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid completion data',
          details: error.errors
        }
      });
    }
    
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'COMPLETION_ERROR',
          message: error.message
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete habit'
      }
    });
  }
});

/**
 * PATCH /api/habits/:id/pause
 * Pause or unpause a habit
 */
router.patch('/:id/pause', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const habitId = req.params.id;
    const { isPaused, reason } = req.body;
    
    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HABIT_ID',
          message: 'Habit ID is required'
        }
      });
    }
    
    if (typeof isPaused !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAUSE_STATUS',
          message: 'isPaused must be a boolean'
        }
      });
    }
    
    const habit = await habitService.toggleHabitPause(habitId, userId, isPaused, reason);
    
    if (!habit) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'HABIT_NOT_FOUND',
          message: 'Habit not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: habit
    });
  } catch (error) {
    console.error('Error toggling habit pause:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update habit pause status'
      }
    });
  }
});

/**
 * GET /api/habits/:id/completions
 * Get completion history for a habit
 */
router.get('/:id/completions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const habitId = req.params.id;
    const { startDate, endDate } = req.query;
    
    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HABIT_ID',
          message: 'Habit ID is required'
        }
      });
    }
    
    let completions;
    
    if (startDate && endDate) {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate as string) || !dateRegex.test(endDate as string)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Dates must be in YYYY-MM-DD format'
          }
        });
      }
      
      completions = await habitService.getHabitCompletionsInRange(
        habitId, 
        userId, 
        startDate as string, 
        endDate as string
      );
    } else {
      completions = await habitService.getHabitCompletions(habitId, userId);
    }
    
    res.json({
      success: true,
      data: completions
    });
  } catch (error) {
    console.error('Error fetching habit completions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch habit completions'
      }
    });
  }
});

/**
 * GET /api/habits/:id/analytics
 * Get habit analytics and insights
 */
router.get('/:id/analytics', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const habitId = req.params.id;
    const { period, startDate, endDate } = req.query;
    
    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HABIT_ID',
          message: 'Habit ID is required'
        }
      });
    }
    
    // Get streak analysis
    const streakAnalysis = await habitService.getHabitStreakAnalysis(habitId, userId);
    
    if (!streakAnalysis) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'HABIT_NOT_FOUND',
          message: 'Habit not found'
        }
      });
    }
    
    // Get completion rate for the specified period
    let completionRate = null;
    if (startDate && endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(startDate as string) && dateRegex.test(endDate as string)) {
        completionRate = await habitService.getHabitCompletionRate(
          habitId, 
          userId, 
          startDate as string, 
          endDate as string
        );
      }
    }
    
    res.json({
      success: true,
      data: {
        streakAnalysis,
        completionRate
      }
    });
  } catch (error) {
    console.error('Error fetching habit analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch habit analytics'
      }
    });
  }
});

/**
 * GET /api/habits/stats
 * Get habit statistics for the user
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const stats = await habitService.getHabitStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching habit stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch habit statistics'
      }
    });
  }
});

/**
 * GET /api/habits/:id/should-complete
 * Check if habit should be completed today
 */
router.get('/:id/should-complete', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const habitId = req.params.id;
    const { date } = req.query;
    
    if (!habitId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_HABIT_ID',
          message: 'Habit ID is required'
        }
      });
    }
    
    const shouldComplete = await habitService.shouldCompleteToday(
      habitId, 
      userId, 
      date as string
    );
    
    res.json({
      success: true,
      data: {
        shouldComplete,
        date: date || new Date().toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Error checking habit completion status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check habit completion status'
      }
    });
  }
});

export default router;