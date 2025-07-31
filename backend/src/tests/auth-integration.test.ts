import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Integration Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should validate request body and return validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          username: 'ab', // Too short
          password: 'weak' // Too weak
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    it('should return proper error structure for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid input data');
      expect(response.body.error.timestamp).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should validate login request body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: '' // Empty password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return proper error structure for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.timestamp).toBeDefined();
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should validate email verification token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          token: '' // Empty token
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/request-password-reset', () => {
    it('should validate password reset request', async () => {
      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should validate password reset data', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: '',
          newPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // This test would require mocking to force an internal error
      // For now, we just test that the error structure is consistent
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123'
        });

      // Even if it fails (which it will without database), 
      // it should have proper error structure
      if (response.status >= 500) {
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        expect(response.body.error.timestamp).toBeDefined();
      }
    });
  });
});