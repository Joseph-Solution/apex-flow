import { z } from 'zod';

/**
 * Sanitize email input
 */
export const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

/**
 * Sanitize username input
 */
export const sanitizeUsername = (username: string): string => {
  return username.trim().toLowerCase();
};

/**
 * Sanitize name input (first name, last name)
 */
export const sanitizeName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' '); // Replace multiple spaces with single space
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailSchema = z.string().email();
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate username format
 */
export const isValidUsername = (username: string): boolean => {
  const usernameSchema = z.string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/);
  
  try {
    usernameSchema.parse(username);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check for SQL injection patterns
 */
export const containsSQLInjection = (input: string): boolean => {
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|"|`)/,
    /(\bOR\b|\bAND\b).*?[=<>]/i,
    /\b(WAITFOR|DELAY)\b/i,
    /\b(XP_|SP_)/i
  ];

  return sqlInjectionPatterns.some(pattern => pattern.test(input));
};

/**
 * Check for XSS patterns
 */
export const containsXSS = (input: string): boolean => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[^>]*>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi
  ];

  return xssPatterns.some(pattern => pattern.test(input));
};

/**
 * Sanitize input to prevent XSS and SQL injection
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potential XSS and SQL injection patterns
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[<>]/g, '')
    .replace(/['"`;]/g, '')
    .trim();

  return sanitized;
};

/**
 * Validate and sanitize user input
 */
export const validateAndSanitizeUserInput = (data: {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}): {
  isValid: boolean;
  errors: string[];
  sanitizedData: typeof data;
} => {
  const errors: string[] = [];
  const sanitizedData = { ...data };

  // Validate and sanitize email
  if (data.email) {
    if (containsSQLInjection(data.email) || containsXSS(data.email)) {
      errors.push('Email contains invalid characters');
    } else {
      sanitizedData.email = sanitizeEmail(data.email);
      if (!isValidEmail(sanitizedData.email)) {
        errors.push('Invalid email format');
      }
    }
  }

  // Validate and sanitize username
  if (data.username) {
    if (containsSQLInjection(data.username) || containsXSS(data.username)) {
      errors.push('Username contains invalid characters');
    } else {
      sanitizedData.username = sanitizeUsername(data.username);
      if (!isValidUsername(sanitizedData.username)) {
        errors.push('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens');
      }
    }
  }

  // Validate and sanitize names
  if (data.firstName) {
    if (containsSQLInjection(data.firstName) || containsXSS(data.firstName)) {
      errors.push('First name contains invalid characters');
    } else {
      sanitizedData.firstName = sanitizeName(data.firstName);
    }
  }

  if (data.lastName) {
    if (containsSQLInjection(data.lastName) || containsXSS(data.lastName)) {
      errors.push('Last name contains invalid characters');
    } else {
      sanitizedData.lastName = sanitizeName(data.lastName);
    }
  }

  // Password validation (no sanitization needed as it will be hashed)
  if (data.password) {
    if (containsSQLInjection(data.password) || containsXSS(data.password)) {
      errors.push('Password contains invalid characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};