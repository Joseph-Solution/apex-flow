import { Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuthenticate, requirePermission, requireOwnership } from '../middleware/auth';

// Mock the dependencies
jest.mock('../services/JwtService');
jest.mock('../repositories/UserRepository');

// Create a mock implementation that we can control
const mockJwtService = {
  verifyAccessToken: jest.fn()
};

const mockUserRepository = {
  findById: jest.fn()
};

// Mock the modules to return our controlled mocks
jest.doMock('../services/JwtService', () => ({
  JwtService: jest.fn().mockImplementation(() => mockJwtService)
}));

jest.doMock('../repositories/UserRepository', () => ({
  UserRepository: jest.fn().mockImplementation(() => mockUserRepository)
}));

describe('Authentication Middleware Comprehensive Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    timezone: 'UTC',
    level: 1,
    totalXP: 0,
    currentLevelXP: 0,
    nextLevelXP: 100,
    avatarConfig: {
      baseAvatar: 'default',
      accessories: [],
      colors: {}
    },
    unlockedItems: [],
    preferences: {
      notifications: {
        taskReminders: true,
        habitReminders: true,
        achievements: true,
        weeklyReports: true
      },
      theme: 'auto' as const,
      language: 'en',
      workingHours: {
        start: '09:00',
        end: '17:00'
      }
    },
    isActive: true,
    emailVerified: true,
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date()
  };

  const mockDecodedToken = {
    userId: mockUser.id,
    email: mockUser.email,
    username: mockUser.username,
    type: 'access' as const,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock request, response, and next
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      headers: {},
      params: {},
      body: {}
    };
    
    mockResponse = {
      status: statusMock,
      json: jsonMock
    };
    
    mockNext = jest.fn();
  });

  describe('authenticate middleware', () => {
    describe('Security Tests', () => {
      it('should reject requests without authorization header', async () => {
        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authorization token is required',
            timestamp: expect.any(String)
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject malformed authorization headers', async () => {
        const malformedHeaders = [
          'Basic invalid-format',
          'Bearer',
          'Token invalid-format',
          'invalid-header'
        ];

        for (const header of malformedHeaders) {
          mockRequest.headers = { authorization: header };
          
          await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

          expect(statusMock).toHaveBeenCalledWith(401);
          expect(jsonMock).toHaveBeenCalledWith({
            success: false,
            error: {
              code: 'MISSING_TOKEN',
              message: 'Authorization token is required',
              timestamp: expect.any(String)
            }
          });
          expect(mockNext).not.toHaveBeenCalled();

          // Reset mocks for next iteration
          jest.clearAllMocks();
          statusMock.mockReturnValue({ json: jsonMock });
        }
      });

      it('should reject invalid tokens', async () => {
        mockRequest.headers = {
          authorization: 'Bearer invalid-token'
        };

        mockJwtService.verifyAccessToken.mockReturnValue(null);

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
            timestamp: expect.any(String)
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject tokens for non-existent users', async () => {
        mockRequest.headers = {
          authorization: 'Bearer valid-token'
        };

        mockJwtService.verifyAccessToken.mockReturnValue(mockDecodedToken);
        mockUserRepository.findById.mockResolvedValue(null);

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User account not found or inactive',
            timestamp: expect.any(String)
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject tokens for inactive users', async () => {
        mockRequest.headers = {
          authorization: 'Bearer valid-token'
        };

        const inactiveUser = { ...mockUser, isActive: false };
        mockJwtService.verifyAccessToken.mockReturnValue(mockDecodedToken);
        mockUserRepository.findById.mockResolvedValue(inactiveUser);

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User account not found or inactive',
            timestamp: expect.any(String)
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle internal errors gracefully', async () => {
        mockRequest.headers = {
          authorization: 'Bearer valid-token'
        };

        mockJwtService.verifyAccessToken.mockImplementation(() => {
          throw new Error('Internal error');
        });

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Authentication error occurred',
            timestamp: expect.any(String)
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should authenticate valid users successfully', async () => {
        mockRequest.headers = {
          authorization: 'Bearer valid-token'
        };

        mockJwtService.verifyAccessToken.mockReturnValue(mockDecodedToken);
        mockUserRepository.findById.mockResolvedValue(mockUser);

        await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username
        });
        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('optionalAuthenticate middleware', () => {
    describe('Security Tests', () => {
      it('should continue without user when no authorization header', async () => {
        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should continue without user when token is invalid', async () => {
        mockRequest.headers = {
          authorization: 'Bearer invalid-token'
        };

        mockJwtService.verifyAccessToken.mockReturnValue(null);

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should continue without user when user not found', async () => {
        mockRequest.headers = {
          authorization: 'Bearer valid-token'
        };

        mockJwtService.verifyAccessToken.mockReturnValue(mockDecodedToken);
        mockUserRepository.findById.mockResolvedValue(null);

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should continue without user when user is inactive', async () => {
        mockRequest.headers = {
          authorization: 'Bearer valid-token'
        };

        const inactiveUser = { ...mockUser, isActive: false };
        mockJwtService.verifyAccessToken.mockReturnValue(mockDecodedToken);
        mockUserRepository.findById.mockResolvedValue(inactiveUser);

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should continue without user on internal error', async () => {
        mockRequest.headers = {
          authorization: 'Bearer valid-token'
        };

        mockJwtService.verifyAccessToken.mockImplementation(() => {
          throw new Error('Internal error');
        });

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should authenticate valid users successfully', async () => {
        mockRequest.headers = {
          authorization: 'Bearer valid-token'
        };

        mockJwtService.verifyAccessToken.mockReturnValue(mockDecodedToken);
        mockUserRepository.findById.mockResolvedValue(mockUser);

        await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRequest.user).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username
        });
        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('requirePermission middleware', () => {
    describe('Security Tests', () => {
      it('should reject unauthenticated requests', async () => {
        const middleware = requirePermission('read:tasks');
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required for this action',
            timestamp: expect.any(String)
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow authenticated requests', async () => {
        mockRequest.user = {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username
        };

        const middleware = requirePermission('read:tasks');
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('requireOwnership middleware', () => {
    describe('Security Tests', () => {
      it('should reject unauthenticated requests', async () => {
        const middleware = requireOwnership('userId');
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required for this action',
            timestamp: expect.any(String)
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow access to own resources', async () => {
        mockRequest.user = {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username
        };
        mockRequest.params = {
          userId: mockUser.id
        };

        const middleware = requireOwnership('userId');
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });

      it('should reject access to other users resources', async () => {
        mockRequest.user = {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username
        };
        mockRequest.params = {
          userId: 'different-user-id'
        };

        const middleware = requireOwnership('userId');
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only access your own resources',
            timestamp: expect.any(String)
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should check body parameter when specified', async () => {
        mockRequest.user = {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username
        };
        mockRequest.body = {
          userId: 'different-user-id'
        };

        const middleware = requireOwnership('userId');
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only access your own resources',
            timestamp: expect.any(String)
          }
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow access when no resource user ID is provided', async () => {
        mockRequest.user = {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username
        };

        const middleware = requireOwnership('userId');
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', async () => {
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String),
            timestamp: expect.any(String)
          })
        })
      );
    });

    it('should include timestamp in error responses', async () => {
      const beforeTime = new Date().toISOString();
      
      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);
      
      const afterTime = new Date().toISOString();
      const errorResponse = jsonMock.mock.calls[0][0];
      
      expect(errorResponse.error.timestamp).toBeDefined();
      expect(errorResponse.error.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(errorResponse.error.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
});