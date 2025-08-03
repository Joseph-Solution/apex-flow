import request from 'supertest';
import express from 'express';
import {
  authRateLimit,
  loginRateLimit,
  passwordResetRateLimit,
  registrationRateLimit,
  tokenRefreshRateLimit
} from '../middleware/rateLimiting';

describe('Rate Limiting Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('authRateLimit', () => {
    beforeEach(() => {
      app.post('/test-auth', authRateLimit, (req, res) => {
        res.json({ success: true, message: 'Request successful' });
      });
    });

    it('should allow requests within rate limit', async () => {
      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/test-auth')
          .send({ test: 'data' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Make 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/test-auth')
          .send({ test: 'data' })
          .expect(200);
      }

      // 6th request should be blocked
      const response = await request(app)
        .post('/test-auth')
        .send({ test: 'data' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.error.message).toContain('Too many authentication attempts');
      expect(response.body.error.retryAfter).toBeDefined();
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/test-auth')
        .send({ test: 'data' });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('loginRateLimit', () => {
    beforeEach(() => {
      app.post('/test-login', loginRateLimit, (req, res) => {
        res.json({ success: true, message: 'Login successful' });
      });
    });

    it('should allow requests within rate limit', async () => {
      // Make 3 requests (within limit)
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/test-login')
          .send({ email: 'test@example.com', password: 'password' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Make 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/test-login')
          .send({ email: 'test@example.com', password: 'password' })
          .expect(200);
      }

      // 4th request should be blocked
      const response = await request(app)
        .post('/test-login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LOGIN_RATE_LIMIT_EXCEEDED');
      expect(response.body.error.message).toContain('Too many failed login attempts');
    });
  });

  describe('passwordResetRateLimit', () => {
    beforeEach(() => {
      app.post('/test-password-reset', passwordResetRateLimit, (req, res) => {
        res.json({ success: true, message: 'Password reset email sent' });
      });
    });

    it('should allow requests within rate limit', async () => {
      // Make 3 requests (within limit)
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/test-password-reset')
          .send({ email: 'test@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Make 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/test-password-reset')
          .send({ email: 'test@example.com' })
          .expect(200);
      }

      // 4th request should be blocked
      const response = await request(app)
        .post('/test-password-reset')
        .send({ email: 'test@example.com' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PASSWORD_RESET_RATE_LIMIT_EXCEEDED');
      expect(response.body.error.message).toContain('Too many password reset requests');
    });
  });

  describe('registrationRateLimit', () => {
    beforeEach(() => {
      app.post('/test-registration', registrationRateLimit, (req, res) => {
        res.json({ success: true, message: 'Registration successful' });
      });
    });

    it('should allow requests within rate limit', async () => {
      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/test-registration')
          .send({ 
            email: `test${i}@example.com`, 
            username: `user${i}`,
            password: 'password123'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Make 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/test-registration')
          .send({ 
            email: `test${i}@example.com`, 
            username: `user${i}`,
            password: 'password123'
          })
          .expect(200);
      }

      // 6th request should be blocked
      const response = await request(app)
        .post('/test-registration')
        .send({ 
          email: 'test6@example.com', 
          username: 'user6',
          password: 'password123'
        })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REGISTRATION_RATE_LIMIT_EXCEEDED');
      expect(response.body.error.message).toContain('Too many registration attempts');
    });
  });

  describe('tokenRefreshRateLimit', () => {
    beforeEach(() => {
      app.post('/test-token-refresh', tokenRefreshRateLimit, (req, res) => {
        res.json({ success: true, accessToken: 'new-token' });
      });
    });

    it('should allow requests within rate limit', async () => {
      // Make 10 requests (within limit)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/test-token-refresh')
          .send({ refreshToken: 'refresh-token' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Make 10 requests (at limit)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/test-token-refresh')
          .send({ refreshToken: 'refresh-token' })
          .expect(200);
      }

      // 11th request should be blocked
      const response = await request(app)
        .post('/test-token-refresh')
        .send({ refreshToken: 'refresh-token' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_REFRESH_RATE_LIMIT_EXCEEDED');
      expect(response.body.error.message).toContain('Too many token refresh attempts');
    });
  });

  describe('Rate limit error format', () => {
    beforeEach(() => {
      app.post('/test', authRateLimit, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should return properly formatted error response', async () => {
      // Exceed rate limit
      for (let i = 0; i < 6; i++) {
        await request(app).post('/test').send({});
      }

      const response = await request(app)
        .post('/test')
        .send({})
        .expect(429);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('retryAfter');
      
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
      expect(typeof response.body.error.timestamp).toBe('string');
      expect(typeof response.body.error.retryAfter).toBe('number');
    });
  });
});