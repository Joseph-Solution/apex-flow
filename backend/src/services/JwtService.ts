import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export class JwtService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = process.env['JWT_ACCESS_SECRET'] || 'apex-flow-access-secret-key';
    this.refreshTokenSecret = process.env['JWT_REFRESH_SECRET'] || 'apex-flow-refresh-secret-key';
    this.accessTokenExpiry = process.env['JWT_ACCESS_EXPIRY'] || '15m';
    this.refreshTokenExpiry = process.env['JWT_REFRESH_EXPIRY'] || '7d';

    // Warn if using default secrets in production
    if (process.env['NODE_ENV'] === 'production') {
      if (!process.env['JWT_ACCESS_SECRET'] || !process.env['JWT_REFRESH_SECRET']) {
        console.warn('⚠️  WARNING: Using default JWT secrets in production. Please set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables.');
      }
    }
  }

  /**
   * Generate access and refresh token pair
   */
  generateTokenPair(user: User): TokenPair {
    const payload = {
      userId: user.id,
      email: user.email,
      username: user.username
    };

    // Generate access token
    const accessToken = jwt.sign(
      { ...payload, type: 'access' },
      this.accessTokenSecret,
      { 
        expiresIn: this.accessTokenExpiry,
        issuer: 'apex-flow',
        audience: 'apex-flow-client'
      } as jwt.SignOptions
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      this.refreshTokenSecret,
      { 
        expiresIn: this.refreshTokenExpiry,
        issuer: 'apex-flow',
        audience: 'apex-flow-client'
      } as jwt.SignOptions
    );

    // Calculate expiration times in seconds
    const accessExpiresIn = this.parseExpiryToSeconds(this.accessTokenExpiry);
    const refreshExpiresIn = this.parseExpiryToSeconds(this.refreshTokenExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      refreshExpiresIn: refreshExpiresIn
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'apex-flow',
        audience: 'apex-flow-client'
      }) as JwtPayload;

      // Ensure it's an access token
      if (decoded.type !== 'access') {
        return null;
      }

      return decoded;
    } catch (error) {
      console.error('Access token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'apex-flow',
        audience: 'apex-flow-client'
      }) as JwtPayload;

      // Ensure it's a refresh token
      if (decoded.type !== 'refresh') {
        return null;
      }

      return decoded;
    } catch (error) {
      console.error('Refresh token verification failed:', error);
      return null;
    }
  }

  /**
   * Generate new access token from refresh token
   */
  refreshAccessToken(refreshToken: string): { accessToken: string; expiresIn: number } | null {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) {
      return null;
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        userId: decoded.userId,
        email: decoded.email,
        username: decoded.username,
        type: 'access'
      },
      this.accessTokenSecret,
      { 
        expiresIn: this.accessTokenExpiry,
        issuer: 'apex-flow',
        audience: 'apex-flow-client'
      } as jwt.SignOptions
    );

    const expiresIn = this.parseExpiryToSeconds(this.accessTokenExpiry);

    return {
      accessToken,
      expiresIn
    };
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: throw new Error(`Invalid expiry unit: ${unit}`);
    }
  }
}