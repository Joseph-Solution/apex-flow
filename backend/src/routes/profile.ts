import { Router, Request, Response } from 'express';
import { UserProfileService, updateProfileSchema, avatarCustomizationSchema, userPreferencesSchema } from '../services/UserProfileService';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const userProfileService = new UserProfileService();

// Apply authentication middleware to all profile routes
router.use(authenticate);

/**
 * GET /api/profile
 * Get current user's profile
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    const profile = await userProfileService.getProfile(userId);
    
    if (!profile) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user profile',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * PUT /api/profile
 * Update user profile
 */
router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    // Validate request body
    const profileData = updateProfileSchema.parse(req.body);
    
    const updatedProfile = await userProfileService.updateProfile(userId, profileData);
    
    if (!updatedProfile) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid profile data',
          details: error.errors,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user profile',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/profile/stats
 * Get user profile statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    const stats = await userProfileService.getProfileStats(userId);
    
    if (!stats) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching profile stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch profile statistics',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * PUT /api/profile/avatar
 * Update user avatar configuration
 */
router.put('/avatar', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    // Validate avatar configuration
    const avatarConfig = avatarCustomizationSchema.parse(req.body);
    
    // Validate that user has unlocked the requested items
    const validation = await userProfileService.validateAvatarItems(
      userId, 
      [avatarConfig.baseAvatar, ...avatarConfig.accessories]
    );
    
    if (!validation.valid) {
      res.status(403).json({
        success: false,
        error: {
          code: 'AVATAR_ITEMS_LOCKED',
          message: 'Some avatar items are not unlocked',
          details: { invalidItems: validation.invalidItems },
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    
    const updatedProfile = await userProfileService.updateAvatar(userId, avatarConfig);
    
    if (!updatedProfile) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: updatedProfile,
      message: 'Avatar updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid avatar configuration',
          details: error.errors,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    console.error('Error updating avatar:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update avatar',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/profile/avatar/reset
 * Reset avatar to default configuration
 */
router.post('/avatar/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    const updatedProfile = await userProfileService.resetAvatar(userId);
    
    if (!updatedProfile) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: updatedProfile,
      message: 'Avatar reset to default successfully',
    });
  } catch (error) {
    console.error('Error resetting avatar:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset avatar',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * PUT /api/profile/preferences
 * Update user preferences
 */
router.put('/preferences', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    // Validate preferences
    const preferences = userPreferencesSchema.parse(req.body);
    
    const updatedProfile = await userProfileService.updatePreferences(userId, preferences);
    
    if (!updatedProfile) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: updatedProfile,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid preferences data',
          details: error.errors,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    console.error('Error updating preferences:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update preferences',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/profile/unlocked-items
 * Get user's unlocked avatar items
 */
router.get('/unlocked-items', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    const unlockedItems = await userProfileService.getUnlockedItems(userId);

    res.json({
      success: true,
      data: { unlockedItems },
    });
  } catch (error) {
    console.error('Error fetching unlocked items:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch unlocked items',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;