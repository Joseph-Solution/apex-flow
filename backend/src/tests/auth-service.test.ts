import { AuthService } from '../services/AuthService';
import { UserRepository } from '../repositories/UserRepository';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { JwtService } from '../services/JwtService';
import { hashPassword, comparePassword } from '../utils/password';

// Mock dependencies
jest.mock('../repositories/UserRepository');
jest.mock('../repositories/RefreshTokenRepository');
jest.mock('../services/JwtService');
jest.mock('../utils/password');

const MockedUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const MockedRefreshTokenRepository = RefreshTokenRepository as jest.MockedClass<typeof RefreshTokenRepository>;
const MockedJwtService = JwtService as jest.MockedClass<typeof JwtService>;
const mockedHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
const mockedComparePassword = comparePassword as jest.MockedFunction<typeof comparePassword>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockRefreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let mockJwtService: jest.Mocked<JwtService>;

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

  const mockPublicUser = {
    id: mockUser.id,
    email: mockUser.email,
    username: mockUser.username,
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    timezone: mockUser.timezone,
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
      theme: 'auto',
      language: 'en',
      workingHours: {
        start: '09:00',
        end: '17:00'
      }
    },
    isActive: true,
    emailVerified: true,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
    lastLoginAt: mockUser.lastLoginAt
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockUserRepository = new MockedUserRepository() as jest.Mocked<UserRepository>;
    mockRefreshTokenRepository = new MockedRefreshTokenRepository() as jest.Mocked<RefreshTokenRepository>;
    mockJwtService = new MockedJwtService() as jest.Mocked<JwtService>;

    // Mock constructor calls
    MockedUserRepository.mockImplementation(() => mockUserRepository);
    MockedRefreshTokenRepository.mockImplementation(() => mockRefreshTokenRepository);
    MockedJwtService.mockImplementation(() => mockJwtService);

    authService = new AuthService();
  });

  describe('register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    };

    it('should register a new user successfully', async () => {
      // Mock dependencies
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockedHashPassword.mockResolvedValue('hashedpassword');
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      const result = await authService.register(validRegistrationData);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockPublicUser);
      expect(result.errors).toBeUndefined();
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(mockedHashPassword).toHaveBeenCalledWith('TestPassword123!');
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should return error if email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await authService.register(validRegistrationData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Email address is already registered');
      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('should return error if username already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      const result = await authService.register(validRegistrationData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Username is already taken');
      expect(mockedHashPassword).not.toHaveBeenCalled();
    });

    it('should return validation errors for invalid data', async () => {
      const invalidData = {
        email: 'invalid-email',
        username: 'ab', // Too short
        password: '123' // Too weak
      };

      const result = await authService.register(invalidData);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      mockUserRepository.findByEmail.mockRejectedValue(new Error('Database error'));

      const result = await authService.register(validRegistrationData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('An error occurred during registration. Please try again.');
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'TestPassword123!'
    };

    const mockTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      refreshExpiresIn: 604800
    };

    it('should login user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockedComparePassword.mockResolvedValue(true);
      mockJwtService.generateTokenPair.mockReturnValue(mockTokens);
      mockRefreshTokenRepository.create.mockResolvedValue({
        id: 'token-id',
        userId: mockUser.id,
        token: mockTokens.refreshToken,
        expiresAt: new Date(),
        userAgent: null,
        ipAddress: null,
        isRevoked: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockUserRepository.updateLastLogin.mockResolvedValue(mockUser);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      const result = await authService.login(validLoginData, 'test-agent', '127.0.0.1');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockPublicUser);
      expect(result.tokens).toEqual(mockTokens);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockedComparePassword).toHaveBeenCalledWith('TestPassword123!', 'hashedpassword');
      expect(mockJwtService.generateTokenPair).toHaveBeenCalledWith(mockUser);
      expect(mockRefreshTokenRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return error for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await authService.login(validLoginData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid email or password');
      expect(mockedComparePassword).not.toHaveBeenCalled();
    });

    it('should return error for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      const result = await authService.login(validLoginData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Account has been deactivated. Please contact support.');
      expect(mockedComparePassword).not.toHaveBeenCalled();
    });

    it('should return error for invalid password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockedComparePassword.mockResolvedValue(false);

      const result = await authService.login(validLoginData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid email or password');
      expect(mockJwtService.generateTokenPair).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockUserRepository.findByEmail.mockRejectedValue(new Error('Database error'));

      const result = await authService.login(validLoginData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('An error occurred during login. Please try again.');
    });
  });

  describe('changePassword', () => {
    const passwordChangeData = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!'
    };

    it('should change password successfully', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockedComparePassword.mockResolvedValueOnce(true); // Current password check
      mockedComparePassword.mockResolvedValueOnce(false); // New password different check
      mockedHashPassword.mockResolvedValue('newhashed');
      mockUserRepository.updatePassword.mockResolvedValue(mockUser);

      const result = await authService.changePassword(mockUser.id, passwordChangeData);

      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(mockedComparePassword).toHaveBeenCalledWith('OldPassword123!', 'hashedpassword');
      expect(mockedHashPassword).toHaveBeenCalledWith('NewPassword123!');
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(mockUser.id, 'newhashed');
    });

    it('should return error for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await authService.changePassword('invalid-id', passwordChangeData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('User not found');
      expect(mockedComparePassword).not.toHaveBeenCalled();
    });

    it('should return error for incorrect current password', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockedComparePassword.mockResolvedValue(false);

      const result = await authService.changePassword(mockUser.id, passwordChangeData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Current password is incorrect');
      expect(mockedHashPassword).not.toHaveBeenCalled();
    });

    it('should return error if new password is same as current', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockedComparePassword.mockResolvedValueOnce(true); // Current password check
      mockedComparePassword.mockResolvedValueOnce(true); // New password same check

      const result = await authService.changePassword(mockUser.id, passwordChangeData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('New password must be different from current password');
      expect(mockedHashPassword).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockRefreshTokenRepository.revokeToken.mockResolvedValue(true);

      const result = await authService.logout('refresh-token');

      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(mockRefreshTokenRepository.revokeToken).toHaveBeenCalledWith('refresh-token');
    });

    it('should return error for invalid refresh token', async () => {
      mockRefreshTokenRepository.revokeToken.mockResolvedValue(false);

      const result = await authService.logout('invalid-token');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid refresh token');
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices successfully', async () => {
      mockRefreshTokenRepository.revokeAllUserTokens.mockResolvedValue(3);

      const result = await authService.logoutAll(mockUser.id);

      expect(result.success).toBe(true);
      expect(result.revokedCount).toBe(3);
      expect(result.errors).toBeUndefined();
      expect(mockRefreshTokenRepository.revokeAllUserTokens).toHaveBeenCalledWith(mockUser.id);
    });

    it('should handle database errors gracefully', async () => {
      mockRefreshTokenRepository.revokeAllUserTokens.mockRejectedValue(new Error('Database error'));

      const result = await authService.logoutAll(mockUser.id);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('An error occurred during logout. Please try again.');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockRefreshTokenRepository.isTokenValid.mockResolvedValue(true);
      mockJwtService.refreshAccessToken.mockReturnValue({
        accessToken: 'new-access-token',
        expiresIn: 3600
      });

      const result = await authService.refreshToken('refresh-token');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.expiresIn).toBe(3600);
      expect(result.errors).toBeUndefined();
    });

    it('should return error for invalid refresh token', async () => {
      mockRefreshTokenRepository.isTokenValid.mockResolvedValue(false);

      const result = await authService.refreshToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid or expired refresh token');
      expect(mockJwtService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should return error if JWT service fails', async () => {
      mockRefreshTokenRepository.isTokenValid.mockResolvedValue(true);
      mockJwtService.refreshAccessToken.mockReturnValue(null);

      const result = await authService.refreshToken('refresh-token');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to generate new access token');
    });
  });

  describe('validateToken', () => {
    const mockDecodedToken = {
      userId: mockUser.id,
      email: mockUser.email,
      username: mockUser.username,
      type: 'access' as const,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    it('should validate token successfully', async () => {
      mockJwtService.verifyAccessToken.mockReturnValue(mockDecodedToken);
      mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

      const result = await authService.validateToken('access-token');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockPublicUser);
      expect(result.errors).toBeUndefined();
      expect(mockJwtService.verifyAccessToken).toHaveBeenCalledWith('access-token');
      expect(mockUserRepository.getPublicUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return error for invalid token', async () => {
      mockJwtService.verifyAccessToken.mockReturnValue(null);

      const result = await authService.validateToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid or expired access token');
      expect(mockUserRepository.getPublicUser).not.toHaveBeenCalled();
    });

    it('should return error if user not found', async () => {
      mockJwtService.verifyAccessToken.mockReturnValue(mockDecodedToken);
      mockUserRepository.getPublicUser.mockResolvedValue(null);

      const result = await authService.validateToken('access-token');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('User not found');
    });
  });

  describe('cleanupTokens', () => {
    it('should cleanup expired and old revoked tokens', async () => {
      mockRefreshTokenRepository.deleteExpiredTokens.mockResolvedValue(5);
      mockRefreshTokenRepository.deleteOldRevokedTokens.mockResolvedValue(3);

      const result = await authService.cleanupTokens();

      expect(result.expiredCount).toBe(5);
      expect(result.revokedCount).toBe(3);
      expect(mockRefreshTokenRepository.deleteExpiredTokens).toHaveBeenCalled();
      expect(mockRefreshTokenRepository.deleteOldRevokedTokens).toHaveBeenCalledWith(30);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockRefreshTokenRepository.deleteExpiredTokens.mockRejectedValue(new Error('Database error'));

      const result = await authService.cleanupTokens();

      expect(result.expiredCount).toBe(0);
      expect(result.revokedCount).toBe(0);
    });
  });
});