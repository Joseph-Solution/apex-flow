import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/JwtService';
import { UserRepository } from '../repositories/UserRepository';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    username: string;
  };
}

export class AuthMiddleware {
  private jwtService: JwtService;
  private userRepository: UserRepository;

  constructor() {
    this.jwtService = new JwtService();
    this.userRepository = new UserRepository();
  }

  /**
   * Middleware to authenticate requests using JWT tokens
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authorization token is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify the token
      const decoded = this.jwtService.verifyAccessToken(token);
      if (!decoded) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Check if user still exists and is active
      const user = await this.userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User account not found or inactive',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Add user information to request
      req.user = {
        id: user.id,
        email: user.email,
        username: user.username
      };

      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * Optional authentication middleware - doesn't fail if no token provided
   */
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      // If no auth header, continue without user
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next();
        return;
      }

      const token = authHeader.substring(7);
      const decoded = this.jwtService.verifyAccessToken(token);
      
      if (decoded) {
        // Check if user exists and is active
        const user = await this.userRepository.findById(decoded.userId);
        if (user && user.isActive) {
          req.user = {
            id: user.id,
            email: user.email,
            username: user.username
          };
        }
      }

      next();
    } catch (error) {
      console.error('Optional authentication middleware error:', error);
      // Continue without user on error
      next();
    }
  };

  /**
   * Middleware to check if user has specific permissions
   */
  requirePermission = (permission: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // First ensure user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required for this action',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // TODO: Implement permission checking logic
      // For now, all authenticated users have all permissions
      // This can be extended later with role-based access control
      
      next();
    };
  };

  /**
   * Middleware to ensure user can only access their own resources
   */
  requireOwnership = (userIdParam: string = 'userId') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required for this action',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
      
      if (resourceUserId && resourceUserId !== req.user.id) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only access your own resources',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      next();
    };
  };
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

// Export middleware functions
export const authenticate = authMiddleware.authenticate;
export const optionalAuthenticate = authMiddleware.optionalAuthenticate;
export const requirePermission = authMiddleware.requirePermission;
export const requireOwnership = authMiddleware.requireOwnership;