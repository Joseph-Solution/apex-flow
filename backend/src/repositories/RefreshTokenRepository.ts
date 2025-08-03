import { eq, and, lt } from 'drizzle-orm';
import { db } from '../db/connection';
import { refreshTokens, RefreshToken, NewRefreshToken } from '../db/schema/refreshTokens';

export class RefreshTokenRepository {
  /**
   * Create a new refresh token
   */
  async create(tokenData: NewRefreshToken): Promise<RefreshToken> {
    const [token] = await db.insert(refreshTokens).values(tokenData).returning();
    return token;
  }

  /**
   * Find refresh token by token string
   */
  async findByToken(token: string): Promise<RefreshToken | null> {
    const [refreshToken] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, token),
          eq(refreshTokens.isRevoked, false)
        )
      );
    return refreshToken || null;
  }

  /**
   * Find all active refresh tokens for a user
   */
  async findByUserId(userId: string): Promise<RefreshToken[]> {
    return await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isRevoked, false)
        )
      );
  }

  /**
   * Revoke a refresh token
   */
  async revokeToken(token: string): Promise<boolean> {
    const result = await db
      .update(refreshTokens)
      .set({ 
        isRevoked: true,
        updatedAt: new Date()
      })
      .where(eq(refreshTokens.token, token))
      .returning();
    
    return result.length > 0;
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await db
      .update(refreshTokens)
      .set({ 
        isRevoked: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isRevoked, false)
        )
      )
      .returning();
    
    return result.length;
  }

  /**
   * Delete expired tokens (cleanup)
   */
  async deleteExpiredTokens(): Promise<number> {
    const result = await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning();
    
    return result.length;
  }

  /**
   * Delete revoked tokens older than specified days
   */
  async deleteOldRevokedTokens(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await db
      .delete(refreshTokens)
      .where(
        and(
          eq(refreshTokens.isRevoked, true),
          lt(refreshTokens.updatedAt, cutoffDate)
        )
      )
      .returning();
    
    return result.length;
  }

  /**
   * Get token count for a user
   */
  async getUserTokenCount(userId: string): Promise<number> {
    const tokens = await this.findByUserId(userId);
    return tokens.length;
  }

  /**
   * Check if token exists and is valid
   */
  async isTokenValid(token: string): Promise<boolean> {
    const refreshToken = await this.findByToken(token);
    if (!refreshToken) {
      return false;
    }

    // Check if token is expired
    if (refreshToken.expiresAt < new Date()) {
      // Automatically revoke expired token
      await this.revokeToken(token);
      return false;
    }

    return true;
  }
}