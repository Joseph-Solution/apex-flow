import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { 
  registerUserSchema, 
  loginUserSchema, 
  changePasswordSchema,
  emailVerificationSchema,
  passwordResetRequestSchema,
  passwordResetSchema
} from '../models/User';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = registerUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Register user
    const result = await authService.register(validation.data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: result.errors?.join(', ') || 'Registration failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response
    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        message: 'User registered successfully. Please check your email to verify your account.'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Registration endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = loginUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Login user
    const result = await authService.login(validation.data);

    if (!result.success) {
      res.status(401).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: result.errors?.join(', ') || 'Login failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        message: 'Login successful'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password (requires authentication)
 */
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication middleware to get userId from token
    const userId = req.body.userId; // Temporary - will be replaced with auth middleware

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate request body
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Change password
    const result = await authService.changePassword(userId, validation.data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_FAILED',
          message: result.errors?.join(', ') || 'Password change failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        message: 'Password changed successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Change password endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify user email address
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = emailVerificationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Verify email
    const result = await authService.verifyEmail(validation.data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_VERIFICATION_FAILED',
          message: result.errors?.join(', ') || 'Email verification failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        message: 'Email verified successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Email verification endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/auth/request-password-reset
 * Request password reset
 */
router.post('/request-password-reset', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = passwordResetRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Request password reset
    const result = await authService.requestPasswordReset(validation.data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORD_RESET_REQUEST_FAILED',
          message: result.errors?.join(', ') || 'Password reset request failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response (always success for security)
    res.status(200).json({
      success: true,
      data: {
        message: 'If an account with that email exists, a password reset link has been sent.'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Password reset request endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = passwordResetSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          })),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Reset password
    const result = await authService.resetPassword(validation.data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORD_RESET_FAILED',
          message: result.errors?.join(', ') || 'Password reset failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        message: 'Password reset successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Password reset endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;