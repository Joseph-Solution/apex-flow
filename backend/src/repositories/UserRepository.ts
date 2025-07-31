import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import { users, User, NewUser, UpdateUser, PublicUser } from '../db/schema/users';

export class UserRepository {
  /**
   * Create a new user
   */
  async create(userData: NewUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user || null;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    return user || null;
  }

  /**
   * Find user by email verification token
   */
  async findByEmailVerificationToken(token: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(
      and(
        eq(users.emailVerificationToken, token),
        eq(users.emailVerified, false)
      )
    );
    return user || null;
  }

  /**
   * Find user by password reset token
   */
  async findByPasswordResetToken(token: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(
      and(
        eq(users.passwordResetToken, token),
        // Token should not be expired (assuming passwordResetExpires is set)
      )
    );
    return user || null;
  }

  /**
   * Update user by ID
   */
  async update(id: string, userData: Partial<UpdateUser>): Promise<User | null> {
    const updateData: any = {
      ...userData,
      updatedAt: new Date(),
    };

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    
    return user || null;
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, passwordHash: string): Promise<User | null> {
    const [user] = await db
      .update(users)
      .set({ 
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    return user || null;
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string): Promise<User | null> {
    const [user] = await db
      .update(users)
      .set({ 
        emailVerified: true,
        emailVerificationToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    return user || null;
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(id: string, token: string, expiresAt: Date): Promise<User | null> {
    const [user] = await db
      .update(users)
      .set({ 
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    return user || null;
  }

  /**
   * Clear password reset token
   */
  async clearPasswordResetToken(id: string): Promise<User | null> {
    const [user] = await db
      .update(users)
      .set({ 
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    return user || null;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<User | null> {
    const [user] = await db
      .update(users)
      .set({ 
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    return user || null;
  }

  /**
   * Delete user (soft delete by setting isActive to false)
   */
  async softDelete(id: string): Promise<User | null> {
    const [user] = await db
      .update(users)
      .set({ 
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    return user || null;
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    
    return !!user;
  }

  /**
   * Check if username exists
   */
  async usernameExists(username: string): Promise<boolean> {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username.toLowerCase()));
    
    return !!user;
  }

  /**
   * Get public user data (without sensitive information)
   */
  async getPublicUser(id: string): Promise<PublicUser | null> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        timezone: users.timezone,
        level: users.level,
        totalXP: users.totalXP,
        currentLevelXP: users.currentLevelXP,
        nextLevelXP: users.nextLevelXP,
        avatarConfig: users.avatarConfig,
        unlockedItems: users.unlockedItems,
        preferences: users.preferences,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, id));
    
    return user || null;
  }
}