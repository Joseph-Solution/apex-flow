import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Integration Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'TestPassword123',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.passwordHash).toBeUndefined(); // Should not expose password hash
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        email: 'invalid-email',
        username: 'ab', // Too short
        password: '123' // Too weak
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user and return JWT tokens', async () => {
      // First register a user
      const userData = {
        email: 'login-test@example.com',
        username: 'loginuser',
        password: 'TestPassword123',
        firstName: 'Login',
        lastName: 'User'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Then login
      const loginData = {
        email: userData.email,
        password: userData.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.tokens.expiresIn).toBeDefined();
      expect(response.body.data.tokens.refreshExpiresIn).toBeDefined();
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LOGIN_FAILED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // Register and login to get tokens
      const userData = {
        email: 'refresh-test@example.com',
        username: 'refreshuser',
        password: 'TestPassword123',
        firstName: 'Refresh',
        lastName: 'User'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password });

      const { refreshToken } = loginResponse.body.data.tokens;

      // Refresh the token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.expiresIn).toBeDefined();
    });

    it('should return error for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_REFRESH_FAILED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user by revoking refresh token', async () => {
      // Register and login to get tokens
      const userData = {
        email: 'logout-test@example.com',
        username: 'logoutuser',
        password: 'TestPassword123',
        firstName: 'Logout',
        lastName: 'User'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password });

      const { refreshToken } = loginResponse.body.data.tokens;

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Logout successful');

      // Try to use the refresh token again - should fail
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('POST /api/auth/validate', () => {
    it('should validate access token and return user info', async () => {
      // Register and login to get tokens
      const userData = {
        email: 'validate-test@example.com',
        username: 'validateuser',
        password: 'TestPassword123',
        firstName: 'Validate',
        lastName: 'User'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password });

      const { accessToken } = loginResponse.body.data.tokens;

      // Validate token
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ accessToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
    });

    it('should return error for invalid access token', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ accessToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_VALIDATION_FAILED');
    });
  });
});