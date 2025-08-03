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

describe('AuthService Comprehensive Tests', () => {
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
      theme: 'auto' as const,
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

  describe('Security Tests', () => {
    describe('Password Security', () => {
      it('should hash passwords before storing', async () => {
        const validRegistrationData = {
          email: 'test@example.com',
          username: 'testuser',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        };

        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockUserRepository.findByUsername.mockResolvedValue(null);
        mockedHashPassword.mockResolvedValue('hashedpassword');
        mockUserRepository.create.mockResolvedValue(mockUser);
        mockUserRepository.getPublicUser.mockResolvedValue(mockPublicUser);

        await authService.register(validRegistrationData);

        expect(mockedHashPassword).toHaveBeenCalledWith('TestPassword123!');
        expect(mockUserRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            passwordHash: 'hashedpassword'
          })
        );
      });

      it('should verify passwords using secure comparison', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'TestPassword123!'
        };

        mockUserRepository.findByEmail.mockResolvedValue(mockUser);
        mockedComparePassword.mockResolvedValue(true);

        await authService.login(loginData);

        expect(mockedComparePassword).toHaveBeenCalledWith('TestPassword123!', 'hashedpassword');
      });

      it('should reject weak passwords during registration', async () => {
        const weakPasswordData = {
          email: 'test@example.com',
          username: 'testuser',
          password: '123', // Too weak
          firstName: 'Test',
          lastName: 'User'
        };

        const result = await authService.register(weakPasswordData);

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(mockedHashPassword).not.toHaveBeenCalled();
      });
    });

    describe('Input Validation', () => {
      it('should validate email format during registration', async () => {
        const invalidEmailData = {
          email: 'invalid-email',
          username: 'testuser',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        };

        const result = await authService.register(invalidEmailData);

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
      });

      it('should validate username length during registration', async () => {
        const shortUsernameData = {
          email: 'test@example.com',
          username: 'ab', // Too short
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        };

        const result = await authService.register(shortUsernameData);

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });

      it('should sanitize input data', async () => {
        const maliciousData = {
          email: 'test@example.com',
          username: '<script>alert("xss")</script>',
          password: 'TestPassword123!',
          firstName: '<img src=x onerror=alert(1)>',
          lastName: 'Test'
        };

        const result = await authService.register(maliciousData);

        // Should fail validation due to malicious content
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });
    });

    describe('Account Security', () => {
      it('should prevent duplicate email registration', async () => {
        const userData = {
          email: 'test@example.com',
          username: 'testuser',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        };

        mockUserRepository.findByEmail.mockResolvedValue(mockUser);

        const result = await authService.register(userData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Email address is already registered');
      });

      it('should prevent duplicate username registration', async () => {
        const userData = {
          email: 'test@example.com',
          username: 'testuser',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        };

        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockUserRepository.findByUsername.mockResolvedValue(mockUser);

        const result = await authService.register(userData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Username is already taken');
      });

      it('should prevent login for inactive users', async () => {
        const inactiveUser = { ...mockUser, isActive: false };
        const loginData = {
          email: 'test@example.com',
          password: 'TestPassword123!'
        };

        mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

        const result = await authService.login(loginData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Account has been deactivated. Please contact support.');
      });
    });

    describe('Token Security', () => {
      it('should generate secure token pairs', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'TestPassword123!'
        };

        const mockTokens = {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          refreshExpiresIn: 604800
        };

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

        const result = await authService.login(loginData, 'test-agent', '127.0.0.1');

        expect(result.success).toBe(true);
        expect(result.tokens).toEqual(mockTokens);
        expect(mockJwtService.generateTokenPair).toHaveBeenCalledWith(mockUser);
        expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUser.id,
            token: mockTokens.refreshToken,
            userAgent: 'test-agent',
            ipAddress: '127.0.0.1'
          })
        );
      });

      it('should validate refresh tokens before use', async () => {
        mockRefreshTokenRepository.isTokenValid.mockResolvedValue(false);

        const result = await authService.refreshToken('invalid-token');

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid or expired refresh token');
        expect(mockJwtService.refreshAccessToken).not.toHaveBeenCalled();
      });

      it('should revoke tokens on logout', async () => {
        mockRefreshTokenRepository.revokeToken.mockResolvedValue(true);

        const result = await authService.logout('refresh-token');

        expect(result.success).toBe(true);
        expect(mockRefreshTokenRepository.revokeToken).toHaveBeenCalledWith('refresh-token');
      });

      it('should revoke all user tokens on logout all', async () => {
        mockRefreshTokenRepository.revokeAllUserTokens.mockResolvedValue(3);

        const result = await authService.logoutAll(mockUser.id);

        expect(result.success).toBe(true);
        expect(result.revokedCount).toBe(3);
        expect(mockRefreshTokenRepository.revokeAllUserTokens).toHaveBeenCalledWith(mockUser.id);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully during registration', async () => {
        const userData = {
          email: 'test@example.com',
          username: 'testuser',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        };

        mockUserRepository.findByEmail.mockRejectedValue(new Error('Database error'));

        const result = await authService.register(userData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('An error occurred during registration. Please try again.');
      });

      it('should handle database errors gracefully during login', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'TestPassword123!'
        };

        mockUserRepository.findByEmail.mockRejectedValue(new Error('Database error'));

        const result = await authService.login(loginData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('An error occurred during login. Please try again.');
      });

      it('should not expose sensitive information in error messages', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'wrongpassword'
        };

        mockUserRepository.findByEmail.mockResolvedValue(mockUser);
        mockedComparePassword.mockResolvedValue(false);

        const result = await authService.login(loginData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid email or password');
        // Should not expose whether email exists or password is wrong
        expect(result.errors?.join(' ')).not.toContain('password is incorrect');
        expect(result.errors?.join(' ')).not.toContain('user not found');
      });
    });

    describe('Password Change Security', () => {
      it('should verify current password before changing', async () => {
        const passwordChangeData = {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!'
        };

        mockUserRepository.findById.mockResolvedValue(mockUser);
        mockedComparePassword.mockResolvedValueOnce(false); // Current password check fails

        const result = await authService.changePassword(mockUser.id, passwordChangeData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Current password is incorrect');
        expect(mockedHashPassword).not.toHaveBeenCalled();
      });

      it('should prevent setting same password', async () => {
        const passwordChangeData = {
          currentPassword: 'SamePassword123!',
          newPassword: 'SamePassword123!'
        };

        mockUserRepository.findById.mockResolvedValue(mockUser);
        mockedComparePassword.mockResolvedValueOnce(true); // Current password check
        mockedComparePassword.mockResolvedValueOnce(true); // New password same check

        const result = await authService.changePassword(mockUser.id, passwordChangeData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('New password must be different from current password');
      });

      it('should hash new password before storing', async () => {
        const passwordChangeData = {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!'
        };

        mockUserRepository.findById.mockResolvedValue(mockUser);
        mockedComparePassword.mockResolvedValueOnce(true); // Current password check
        mockedComparePassword.mockResolvedValueOnce(false); // New password different check
        mockedHashPassword.mockResolvedValue('newhashed');
        mockUserRepository.updatePassword.mockResolvedValue(mockUser);

        const result = await authService.changePassword(mockUser.id, passwordChangeData);

        expect(result.success).toBe(true);
        expect(mockedHashPassword).toHaveBeenCalledWith('NewPassword123!');
        expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(mockUser.id, 'newhashed');
      });
    });

    describe('Token Cleanup', () => {
      it('should cleanup expired tokens', async () => {
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
});