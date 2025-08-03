import { JwtService } from '../services/JwtService';
import { User } from '../models/User';

describe('JWT Authentication', () => {
  let jwtService: JwtService;
  
  const mockUser: User = {
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
      theme: 'auto',
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

  beforeEach(() => {
    jwtService = new JwtService();
  });

  describe('Token Generation', () => {
    it('should generate access and refresh token pair', () => {
      const tokens = jwtService.generateTokenPair(mockUser);
      
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresIn');
      expect(tokens).toHaveProperty('refreshExpiresIn');
      
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
      expect(typeof tokens.expiresIn).toBe('number');
      expect(typeof tokens.refreshExpiresIn).toBe('number');
    });

    it('should generate different tokens for each call', async () => {
      const tokens1 = jwtService.generateTokenPair(mockUser);
      
      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const tokens2 = jwtService.generateTokenPair(mockUser);
      
      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('Token Verification', () => {
    it('should verify valid access token', () => {
      const tokens = jwtService.generateTokenPair(mockUser);
      const decoded = jwtService.verifyAccessToken(tokens.accessToken);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(mockUser.id);
      expect(decoded?.email).toBe(mockUser.email);
      expect(decoded?.username).toBe(mockUser.username);
      expect(decoded?.type).toBe('access');
    });

    it('should verify valid refresh token', () => {
      const tokens = jwtService.generateTokenPair(mockUser);
      const decoded = jwtService.verifyRefreshToken(tokens.refreshToken);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(mockUser.id);
      expect(decoded?.email).toBe(mockUser.email);
      expect(decoded?.username).toBe(mockUser.username);
      expect(decoded?.type).toBe('refresh');
    });

    it('should reject invalid tokens', () => {
      const invalidToken = 'invalid.token.here';
      
      expect(jwtService.verifyAccessToken(invalidToken)).toBeNull();
      expect(jwtService.verifyRefreshToken(invalidToken)).toBeNull();
    });

    it('should reject access token as refresh token', () => {
      const tokens = jwtService.generateTokenPair(mockUser);
      
      expect(jwtService.verifyRefreshToken(tokens.accessToken)).toBeNull();
    });

    it('should reject refresh token as access token', () => {
      const tokens = jwtService.generateTokenPair(mockUser);
      
      expect(jwtService.verifyAccessToken(tokens.refreshToken)).toBeNull();
    });
  });

  describe('Token Refresh', () => {
    it('should generate new access token from valid refresh token', () => {
      const tokens = jwtService.generateTokenPair(mockUser);
      const result = jwtService.refreshAccessToken(tokens.refreshToken);
      
      expect(result).not.toBeNull();
      expect(result?.accessToken).toBeDefined();
      expect(result?.expiresIn).toBeDefined();
      expect(typeof result?.accessToken).toBe('string');
      expect(typeof result?.expiresIn).toBe('number');
    });

    it('should reject invalid refresh token for refresh', () => {
      const invalidToken = 'invalid.token.here';
      const result = jwtService.refreshAccessToken(invalidToken);
      
      expect(result).toBeNull();
    });
  });

  describe('Token Utilities', () => {
    it('should decode token without verification', () => {
      const tokens = jwtService.generateTokenPair(mockUser);
      const decoded = jwtService.decodeToken(tokens.accessToken);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(mockUser.id);
      expect(decoded?.type).toBe('access');
    });

    it('should check token expiration', () => {
      const tokens = jwtService.generateTokenPair(mockUser);
      
      // Fresh token should not be expired
      expect(jwtService.isTokenExpired(tokens.accessToken)).toBe(false);
      expect(jwtService.isTokenExpired(tokens.refreshToken)).toBe(false);
    });

    it('should get token expiration time', () => {
      const tokens = jwtService.generateTokenPair(mockUser);
      const expiration = jwtService.getTokenExpiration(tokens.accessToken);
      
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });
  });
});