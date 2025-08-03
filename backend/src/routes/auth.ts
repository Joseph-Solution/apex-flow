import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
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
 * Login user with JWT tokens
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

    // Extract user agent and IP address for token tracking
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Login user
    const result = await authService.login(validation.data, userAgent, ipAddress);

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

    // Return success response with tokens
    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        tokens: result.tokens,
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
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

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

/**
 * POST /api/auth/logout
 * Logout user by revoking refresh token
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Logout user
    const result = await authService.logout(refreshToken);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: result.errors?.join(', ') || 'Logout failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        message: 'Logout successful'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Logout endpoint error:', error);
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
 * POST /api/auth/logout-all
 * Logout from all devices by revoking all refresh tokens
 */
router.post('/logout-all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Logout from all devices
    const result = await authService.logoutAll(userId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'LOGOUT_ALL_FAILED',
          message: result.errors?.join(', ') || 'Logout from all devices failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        message: 'Logged out from all devices successfully',
        revokedCount: result.revokedCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Logout all endpoint error:', error);
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
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Refresh access token
    const result = await authService.refreshToken(refreshToken);

    if (!result.success) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: result.errors?.join(', ') || 'Token refresh failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response with new access token
    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        message: 'Token refreshed successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token refresh endpoint error:', error);
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
 * POST /api/auth/validate
 * Validate access token and return user info
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Access token is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate access token
    const result = await authService.validateToken(accessToken);

    if (!result.success) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_VALIDATION_FAILED',
          message: result.errors?.join(', ') || 'Token validation failed',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Return success response with user info
    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        message: 'Token is valid'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token validation endpoint error:', error);
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