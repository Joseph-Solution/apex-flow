import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Extend Request interface to include rateLimit property
declare module 'express' {
  interface Request {
    rateLimit?: {
      limit: number;
      current: number;
      remaining: number;
      resetTime?: number;
    };
  }
}

/**
 * Rate limiting configuration for authentication endpoints
 */

// General authentication rate limiting (more restrictive)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((req.rateLimit?.resetTime || Date.now()) / 1000)
      }
    });
  }
});

// Login-specific rate limiting (very restrictive)
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 login attempts per windowMs
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again in 15 minutes.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'LOGIN_RATE_LIMIT_EXCEEDED',
        message: 'Too many failed login attempts. Please try again in 15 minutes.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((req.rateLimit?.resetTime || Date.now()) / 1000)
      }
    });
  }
});

// Password reset rate limiting
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset requests. Please try again in 1 hour.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
        message: 'Too many password reset requests. Please try again in 1 hour.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((req.rateLimit?.resetTime || Date.now()) / 1000)
      }
    });
  }
});

// Registration rate limiting
export const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 registration attempts per hour
  message: {
    success: false,
    error: {
      code: 'REGISTRATION_RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts. Please try again in 1 hour.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'REGISTRATION_RATE_LIMIT_EXCEEDED',
        message: 'Too many registration attempts. Please try again in 1 hour.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((req.rateLimit?.resetTime || Date.now()) / 1000)
      }
    });
  }
});

// Token refresh rate limiting
export const tokenRefreshRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 token refresh requests per 5 minutes
  message: {
    success: false,
    error: {
      code: 'TOKEN_REFRESH_RATE_LIMIT_EXCEEDED',
      message: 'Too many token refresh attempts. Please try again in 5 minutes.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOKEN_REFRESH_RATE_LIMIT_EXCEEDED',
        message: 'Too many token refresh attempts. Please try again in 5 minutes.',
        timestamp: new Date().toISOString(),
        retryAfter: Math.round((req.rateLimit?.resetTime || Date.now()) / 1000)
      }
    });
  }
});