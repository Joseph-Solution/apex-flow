import { validatePasswordStrength, hashPassword, comparePassword } from '../utils/password';
import { validateAndSanitizeUserInput } from '../utils/validation';

describe('Password Utilities', () => {
  describe('validatePasswordStrength', () => {
    it('should validate strong passwords', () => {
      const result = validatePasswordStrength('TestPassword123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result = validatePasswordStrength('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords without uppercase letters', () => {
      const result = validatePasswordStrength('testpassword123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = validatePasswordStrength('TESTPASSWORD123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject passwords without numbers', () => {
      const result = validatePasswordStrength('TestPassword');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject common passwords', () => {
      const result = validatePasswordStrength('password');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common and easily guessable');
    });
  });

  describe('hashPassword and comparePassword', () => {
    it('should hash and verify passwords correctly', async () => {
      const password = 'TestPassword123';
      const hashedPassword = await hashPassword(password);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      
      const isValid = await comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await comparePassword('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });
});

describe('Input Validation', () => {
  describe('validateAndSanitizeUserInput', () => {
    it('should validate and sanitize valid user input', () => {
      const input = {
        email: 'TEST@EXAMPLE.COM',
        username: 'TestUser',
        firstName: 'Test',
        lastName: 'User'
      };

      const result = validateAndSanitizeUserInput(input);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedData.email).toBe('test@example.com');
      expect(result.sanitizedData.username).toBe('testuser');
    });

    it('should reject invalid email formats', () => {
      const input = {
        email: 'invalid-email',
        username: 'testuser'
      };

      const result = validateAndSanitizeUserInput(input);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should reject invalid usernames', () => {
      const input = {
        email: 'test@example.com',
        username: 'ab' // Too short
      };

      const result = validateAndSanitizeUserInput(input);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens');
    });

    it('should detect SQL injection attempts', () => {
      const input = {
        email: 'test@example.com',
        username: "admin'; DROP TABLE users; --"
      };

      const result = validateAndSanitizeUserInput(input);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username contains invalid characters');
    });

    it('should detect XSS attempts', () => {
      const input = {
        email: 'test@example.com',
        firstName: '<script>alert("xss")</script>'
      };

      const result = validateAndSanitizeUserInput(input);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('First name contains invalid characters');
    });
  });
});

