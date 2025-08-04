import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import { 
  achievements, 
  userAchievements, 
  achievementProgress,
  Achievement, 
  NewAchievement, 
  UpdateAchievement,
  UserAchievement,
  NewUserAchievement,
  AchievementProgress,
  NewAchievementProgress
} from '../db/schema/achievements';

export class AchievementRepository {
  /**
   * Create a new achievement
   */
  async createAchievement(achievementData: NewAchievement): Promise<Achievement> {
    const [achievement] = await db.insert(achievements).values(achievementData).returning();
    return achievement;
  }

  /**
   * Get all achievements
   */
  async getAllAchievements(includeInactive: boolean = false): Promise<Achievement[]> {
    const query = db.select().from(achievements);
    
    if (!includeInactive) {
      query.where(eq(achievements.isActive, true));
    }
    
    return await query.orderBy(asc(achievements.sortOrder), asc(achievements.createdAt));
  }

  /**
   * Get achievement by ID
   */
  async getAchievementById(id: string): Promise<Achievement | null> {
    const [achievement] = await db.select().from(achievements).where(eq(achievements.id, id));
    return achievement || null;
  }

  /**
   * Get achievements by category
   */
  async getAchievementsByCategory(category: string): Promise<Achievement[]> {
    return await db.select()
      .from(achievements)
      .where(and(
        eq(achievements.category, category as any),
        eq(achievements.isActive, true)
      ))
      .orderBy(asc(achievements.sortOrder));
  }

  /**
   * Update achievement
   */
  async updateAchievement(id: string, updateData: Partial<UpdateAchievement>): Promise<Achievement | null> {
    const [achievement] = await db
      .update(achievements)
      .set({ ...updateData as any, updatedAt: new Date() })
      .where(eq(achievements.id, id))
      .returning();
    
    return achievement || null;
  }

  /**
   * Delete achievement (soft delete)
   */
  async deleteAchievement(id: string): Promise<Achievement | null> {
    const [achievement] = await db
      .update(achievements)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(achievements.id, id))
      .returning();
    
    return achievement || null;
  }

  /**
   * Get user's achievements (unlocked)
   */
  async getUserAchievements(userId: string): Promise<Array<UserAchievement & { achievement: Achievement }>> {
    return await db.select({
      id: userAchievements.id,
      userId: userAchievements.userId,
      achievementId: userAchievements.achievementId,
      unlockedAt: userAchievements.unlockedAt,
      progress: userAchievements.progress,
      isCompleted: userAchievements.isCompleted,
      unlockedValue: userAchievements.unlockedValue,
      notes: userAchievements.notes,
      createdAt: userAchievements.createdAt,
      achievement: achievements
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.unlockedAt));
  }

  /**
   * Get user's achievement progress
   */
  async getUserAchievementProgress(userId: string): Promise<Array<AchievementProgress & { achievement: Achievement }>> {
    return await db.select({
      id: achievementProgress.id,
      userId: achievementProgress.userId,
      achievementId: achievementProgress.achievementId,
      currentProgress: achievementProgress.currentProgress,
      targetProgress: achievementProgress.targetProgress,
      progressPercentage: achievementProgress.progressPercentage,
      lastUpdated: achievementProgress.lastUpdated,
      progressData: achievementProgress.progressData,
      createdAt: achievementProgress.createdAt,
      updatedAt: achievementProgress.updatedAt,
      achievement: achievements
    })
    .from(achievementProgress)
    .innerJoin(achievements, eq(achievementProgress.achievementId, achievements.id))
    .where(eq(achievementProgress.userId, userId))
    .orderBy(desc(achievementProgress.progressPercentage));
  }

  /**
   * Check if user has unlocked an achievement
   */
  async hasUserUnlockedAchievement(userId: string, achievementId: string): Promise<boolean> {
    const [userAchievement] = await db.select({ id: userAchievements.id })
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId),
        eq(userAchievements.isCompleted, true)
      ));
    
    return !!userAchievement;
  }

  /**
   * Unlock achievement for user
   */
  async unlockAchievement(userId: string, achievementId: string, unlockedValue?: number, notes?: string): Promise<UserAchievement> {
    const [userAchievement] = await db.insert(userAchievements).values({
      userId,
      achievementId,
      isCompleted: true,
      unlockedValue,
      notes,
    }).returning();
    
    return userAchievement;
  }

  /**
   * Update or create achievement progress
   */
  async updateAchievementProgress(
    userId: string, 
    achievementId: string, 
    currentProgress: number, 
    targetProgress: number,
    progressData?: Record<string, any>
  ): Promise<AchievementProgress> {
    const progressPercentage = Math.min(100, Math.round((currentProgress / targetProgress) * 100));
    
    // Try to update existing progress first
    const [existingProgress] = await db.select()
      .from(achievementProgress)
      .where(and(
        eq(achievementProgress.userId, userId),
        eq(achievementProgress.achievementId, achievementId)
      ));

    if (existingProgress) {
      const [updatedProgress] = await db
        .update(achievementProgress)
        .set({
          currentProgress,
          targetProgress,
          progressPercentage,
          progressData: progressData || existingProgress.progressData,
          lastUpdated: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(achievementProgress.id, existingProgress.id))
        .returning();
      
      return updatedProgress;
    } else {
      // Create new progress record
      const [newProgress] = await db.insert(achievementProgress).values({
        userId,
        achievementId,
        currentProgress,
        targetProgress,
        progressPercentage,
        progressData: progressData || {},
      }).returning();
      
      return newProgress;
    }
  }

  /**
   * Get achievement progress for specific achievement
   */
  async getAchievementProgress(userId: string, achievementId: string): Promise<AchievementProgress | null> {
    const [progress] = await db.select()
      .from(achievementProgress)
      .where(and(
        eq(achievementProgress.userId, userId),
        eq(achievementProgress.achievementId, achievementId)
      ));
    
    return progress || null;
  }

  /**
   * Get user's achievement statistics
   */
  async getUserAchievementStats(userId: string): Promise<{
    totalAchievements: number;
    unlockedAchievements: number;
    completionRate: number;
    totalXPFromAchievements: number;
    rareAchievements: number;
    epicAchievements: number;
    legendaryAchievements: number;
    recentUnlocks: Array<{
      achievementId: string;
      name: string;
      unlockedAt: string;
    }>;
  }> {
    // Get total achievements count
    const [totalResult] = await db.select({ count: achievements.id })
      .from(achievements)
      .where(eq(achievements.isActive, true));
    
    const totalAchievements = totalResult ? 1 : 0; // This is a placeholder - actual count would need proper aggregation

    // Get user's unlocked achievements with details
    const unlockedAchievements = await db.select({
      id: userAchievements.id,
      unlockedAt: userAchievements.unlockedAt,
      achievement: achievements
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(and(
      eq(userAchievements.userId, userId),
      eq(userAchievements.isCompleted, true)
    ))
    .orderBy(desc(userAchievements.unlockedAt));

    const unlockedCount = unlockedAchievements.length;
    const completionRate = totalAchievements > 0 ? Math.round((unlockedCount / totalAchievements) * 100) : 0;

    // Calculate XP from achievements
    const totalXPFromAchievements = unlockedAchievements.reduce((total, ua) => {
      return total + (ua.achievement.xpReward || 0);
    }, 0);

    // Count by rarity
    const rareAchievements = unlockedAchievements.filter(ua => ua.achievement.rarity === 'rare').length;
    const epicAchievements = unlockedAchievements.filter(ua => ua.achievement.rarity === 'epic').length;
    const legendaryAchievements = unlockedAchievements.filter(ua => ua.achievement.rarity === 'legendary').length;

    // Recent unlocks (last 5)
    const recentUnlocks = unlockedAchievements.slice(0, 5).map(ua => ({
      achievementId: ua.achievement.id,
      name: ua.achievement.name,
      unlockedAt: ua.unlockedAt.toISOString(),
    }));

    return {
      totalAchievements,
      unlockedAchievements: unlockedCount,
      completionRate,
      totalXPFromAchievements,
      rareAchievements,
      epicAchievements,
      legendaryAchievements,
      recentUnlocks,
    };
  }

  /**
   * Get achievements available to unlock (not yet unlocked by user)
   */
  async getAvailableAchievements(userId: string, includeSecret: boolean = false): Promise<Achievement[]> {
    // Get user's unlocked achievement IDs
    const unlockedIds = await db.select({ achievementId: userAchievements.achievementId })
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.isCompleted, true)
      ));

    const unlockedIdList = unlockedIds.map(ua => ua.achievementId);

    // Get achievements not in the unlocked list
    const whereConditions = [eq(achievements.isActive, true)];
    
    if (!includeSecret) {
      whereConditions.push(eq(achievements.isSecret, false));
    }

    const allAchievements = await db.select()
      .from(achievements)
      .where(and(...whereConditions))
      .orderBy(asc(achievements.sortOrder));

    // Filter out unlocked achievements
    return allAchievements.filter(achievement => !unlockedIdList.includes(achievement.id));
  }

  /**
   * Bulk create achievements (for seeding)
   */
  async bulkCreateAchievements(achievementsData: NewAchievement[]): Promise<Achievement[]> {
    return await db.insert(achievements).values(achievementsData).returning();
  }

  /**
   * Delete user achievement progress (for cleanup)
   */
  async deleteUserAchievementProgress(userId: string, achievementId: string): Promise<boolean> {
    const result = await db.delete(achievementProgress)
      .where(and(
        eq(achievementProgress.userId, userId),
        eq(achievementProgress.achievementId, achievementId)
      ));

    return result.length > 0;
  }

  /**
   * Get achievements by rarity
   */
  async getAchievementsByRarity(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Promise<Achievement[]> {
    return await db.select()
      .from(achievements)
      .where(and(
        eq(achievements.rarity, rarity),
        eq(achievements.isActive, true)
      ))
      .orderBy(asc(achievements.sortOrder));
  }
}