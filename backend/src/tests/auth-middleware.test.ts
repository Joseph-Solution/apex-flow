import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware, authenticate, optionalAuthenticate, requirePermission, requireOwnership } from '../middleware/auth';
import { JwtService } from '../services/JwtService';
import { UserRepository } from '../repositories/UserRepository';

// Mock dependencies
jest.mock('../services/JwtService');
jest.mock('../repositories/UserRepository');

const MockedJwtService = JwtService as jest.MockedClass<typeof JwtService>;
const MockedUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;

describe('AuthMiddleware', () => {
  let mockJwtService: jest.Mocked<JwtService>;
  let mockUserRepository: jest.Mocked<UserRepository>;
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

    // Create mock instances
    mockJwtService = new MockedJwtService() as jest.Mocked<JwtService>;
    mockUserRepository = new MockedUserRepository() as jest.Mocked<UserRepository>;

    // Mock constructor calls
    MockedJwtService.mockImplementation(() => mockJwtService);
    MockedUserRepository.mockImplementation(() => mockUserRepository);

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
    it('should authenticate user with valid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockJwtService.verifyAccessToken.mockReturnValue(mockDecodedToken);
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJwtService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(mockRequest.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username
      });
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header', async () => {
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

    it('should return 401 when authorization header does not start with Bearer', async () => {
      mockRequest.headers = {
        authorization: 'Basic invalid-format'
      };

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

    it('should return 401 when token is invalid', async () => {
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

    it('should return 401 when user not found', async () => {
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

    it('should return 401 when user is inactive', async () => {
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

    it('should return 500 on internal error', async () => {
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
  });

  describe('optionalAuthenticate middleware', () => {
    it('should authenticate user with valid token', async () => {
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
  });

  describe('requirePermission middleware', () => {
    it('should continue when user is authenticated', async () => {
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

    it('should return 401 when user is not authenticated', async () => {
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
  });

  describe('requireOwnership middleware', () => {
    it('should continue when user owns the resource', async () => {
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

    it('should continue when no resource user ID is provided', async () => {
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

    it('should return 401 when user is not authenticated', async () => {
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

    it('should return 403 when user does not own the resource', async () => {
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
  });
});