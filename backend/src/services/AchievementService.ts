import { AchievementRepository } from '../repositories/AchievementRepository';
import { UserRepository } from '../repositories/UserRepository';
import { ExperienceService } from './ExperienceService';
import { UserProfileService } from './UserProfileService';
import { 
  Achievement, 
  NewAchievement, 
  UserAchievement, 
  AchievementProgress,
  AchievementStats
} from '../db/schema/achievements';
import { z } from 'zod';

// Achievement criteria evaluation context
export interface AchievementContext {
  userId: string;
  activityType: 'task' | 'habit' | 'goal' | 'streak' | 'level' | 'xp' | 'custom';
  activityData: Record<string, any>;
  userStats?: {
    level: number;
    totalXP: number;
    tasksCompleted?: number;
    habitsCompleted?: number;
    goalsCompleted?: number;
    longestStreak?: number;
    consecutiveDays?: number;
  };
}

// Achievement unlock result
export interface AchievementUnlockResult {
  achievement: Achievement;
  xpAwarded: number;
  unlockedItems: string[];
  isNewUnlock: boolean;
}

export class AchievementService {
  private achievementRepository: AchievementRepository;
  private userRepository: UserRepository;
  private experienceService: ExperienceService;
  private userProfileService: UserProfileService;

  constructor() {
    this.achievementRepository = new AchievementRepository();
    this.userRepository = new UserRepository();
    this.experienceService = new ExperienceService();
    this.userProfileService = new UserProfileService();
  }

  /**
   * Create a new achievement
   */
  async createAchievement(achievementData: NewAchievement): Promise<Achievement> {
    return await this.achievementRepository.createAchievement(achievementData);
  }

  /**
   * Get all achievements
   */
  async getAllAchievements(includeInactive: boolean = false): Promise<Achievement[]> {
    return await this.achievementRepository.getAllAchievements(includeInactive);
  }

  /**
   * Get achievement by ID
   */
  async getAchievementById(id: string): Promise<Achievement | null> {
    return await this.achievementRepository.getAchievementById(id);
  }

  /**
   * Get user's unlocked achievements
   */
  async getUserAchievements(userId: string): Promise<Array<UserAchievement & { achievement: Achievement }>> {
    return await this.achievementRepository.getUserAchievements(userId);
  }

  /**
   * Get user's achievement progress
   */
  async getUserAchievementProgress(userId: string): Promise<Array<AchievementProgress & { achievement: Achievement }>> {
    return await this.achievementRepository.getUserAchievementProgress(userId);
  }

  /**
   * Get user's achievement statistics
   */
  async getUserAchievementStats(userId: string): Promise<AchievementStats> {
    return await this.achievementRepository.getUserAchievementStats(userId);
  }

  /**
   * Get available achievements for user (not yet unlocked)
   */
  async getAvailableAchievements(userId: string, includeSecret: boolean = false): Promise<Achievement[]> {
    return await this.achievementRepository.getAvailableAchievements(userId, includeSecret);
  }

  /**
   * Check and unlock achievements based on activity
   */
  async checkAndUnlockAchievements(context: AchievementContext): Promise<AchievementUnlockResult[]> {
    const availableAchievements = await this.getAvailableAchievements(context.userId, false);
    const unlockedResults: AchievementUnlockResult[] = [];

    for (const achievement of availableAchievements) {
      const shouldUnlock = await this.evaluateAchievementCriteria(achievement, context);
      
      if (shouldUnlock) {
        const result = await this.unlockAchievement(context.userId, achievement.id, context);
        if (result) {
          unlockedResults.push(result);
        }
      } else {
        // Update progress if not unlocked
        await this.updateAchievementProgress(achievement, context);
      }
    }

    return unlockedResults;
  }

  /**
   * Unlock a specific achievement for a user
   */
  async unlockAchievement(
    userId: string, 
    achievementId: string, 
    context?: AchievementContext
  ): Promise<AchievementUnlockResult | null> {
    // Check if already unlocked
    const alreadyUnlocked = await this.achievementRepository.hasUserUnlockedAchievement(userId, achievementId);
    if (alreadyUnlocked) {
      return null;
    }

    const achievement = await this.achievementRepository.getAchievementById(achievementId);
    if (!achievement) {
      return null;
    }

    // Unlock the achievement
    const unlockedValue = context?.activityData?.value || context?.userStats?.level || 0;
    await this.achievementRepository.unlockAchievement(
      userId, 
      achievementId, 
      unlockedValue,
      context ? `Unlocked via ${context.activityType}` : undefined
    );

    // Award XP
    const xpResult = await this.experienceService.awardXP(userId, {
      type: 'achievement',
      amount: achievement.xpReward,
      reason: `Unlocked achievement: ${achievement.name}`,
      metadata: { achievementId, category: achievement.category },
    });

    // Add unlocked items to user profile
    const unlockedItems = achievement.unlockedItems || [];
    if (unlockedItems.length > 0) {
      await this.userProfileService.addUnlockedItems(userId, unlockedItems);
    }

    return {
      achievement,
      xpAwarded: xpResult?.xpAwarded || 0,
      unlockedItems,
      isNewUnlock: true,
    };
  }

  /**
   * Evaluate if achievement criteria is met
   */
  private async evaluateAchievementCriteria(
    achievement: Achievement, 
    context: AchievementContext
  ): Promise<boolean> {
    const { criteria } = achievement;
    const { activityType, activityData, userStats } = context;

    switch (criteria.type) {
      case 'task_count':
        return this.evaluateTaskCountCriteria(criteria, activityType, activityData, userStats);
      
      case 'habit_streak':
        return this.evaluateHabitStreakCriteria(criteria, activityType, activityData, userStats);
      
      case 'goal_completion':
        return this.evaluateGoalCompletionCriteria(criteria, activityType, activityData, userStats);
      
      case 'level_reached':
        return this.evaluateLevelReachedCriteria(criteria, activityType, activityData, userStats);
      
      case 'xp_earned':
        return this.evaluateXPEarnedCriteria(criteria, activityType, activityData, userStats);
      
      case 'consecutive_days':
        return this.evaluateConsecutiveDaysCriteria(criteria, activityType, activityData, userStats);
      
      case 'custom':
        return this.evaluateCustomCriteria(criteria, context);
      
      default:
        return false;
    }
  }

  /**
   * Evaluate task count criteria
   */
  private evaluateTaskCountCriteria(
    criteria: any, 
    activityType: string, 
    activityData: any, 
    userStats?: any
  ): boolean {
    if (activityType !== 'task') return false;
    
    const tasksCompleted = userStats?.tasksCompleted || 0;
    return tasksCompleted >= criteria.target;
  }

  /**
   * Evaluate habit streak criteria
   */
  private evaluateHabitStreakCriteria(
    criteria: any, 
    activityType: string, 
    activityData: any, 
    userStats?: any
  ): boolean {
    if (activityType !== 'habit' && activityType !== 'streak') return false;
    
    const currentStreak = activityData.currentStreak || userStats?.longestStreak || 0;
    return currentStreak >= criteria.target;
  }

  /**
   * Evaluate goal completion criteria
   */
  private evaluateGoalCompletionCriteria(
    criteria: any, 
    activityType: string, 
    activityData: any, 
    userStats?: any
  ): boolean {
    if (activityType !== 'goal') return false;
    
    const goalsCompleted = userStats?.goalsCompleted || 0;
    return goalsCompleted >= criteria.target;
  }

  /**
   * Evaluate level reached criteria
   */
  private evaluateLevelReachedCriteria(
    criteria: any, 
    activityType: string, 
    activityData: any, 
    userStats?: any
  ): boolean {
    const currentLevel = userStats?.level || 0;
    return currentLevel >= criteria.target;
  }

  /**
   * Evaluate XP earned criteria
   */
  private evaluateXPEarnedCriteria(
    criteria: any, 
    activityType: string, 
    activityData: any, 
    userStats?: any
  ): boolean {
    const totalXP = userStats?.totalXP || 0;
    return totalXP >= criteria.target;
  }

  /**
   * Evaluate consecutive days criteria
   */
  private evaluateConsecutiveDaysCriteria(
    criteria: any, 
    activityType: string, 
    activityData: any, 
    userStats?: any
  ): boolean {
    const consecutiveDays = userStats?.consecutiveDays || 0;
    return consecutiveDays >= criteria.target;
  }

  /**
   * Evaluate custom criteria
   */
  private evaluateCustomCriteria(criteria: any, context: AchievementContext): boolean {
    // Custom criteria evaluation would be implemented based on specific requirements
    // For now, return false as a placeholder
    return false;
  }

  /**
   * Update achievement progress
   */
  private async updateAchievementProgress(
    achievement: Achievement, 
    context: AchievementContext
  ): Promise<void> {
    const currentProgress = this.calculateCurrentProgress(achievement, context);
    const targetProgress = achievement.criteria.target;

    if (currentProgress > 0) {
      await this.achievementRepository.updateAchievementProgress(
        context.userId,
        achievement.id,
        currentProgress,
        targetProgress,
        {
          lastActivity: context.activityType,
          lastUpdate: new Date().toISOString(),
          ...context.activityData,
        }
      );
    }
  }

  /**
   * Calculate current progress for an achievement
   */
  private calculateCurrentProgress(achievement: Achievement, context: AchievementContext): number {
    const { criteria } = achievement;
    const { activityType, activityData, userStats } = context;

    switch (criteria.type) {
      case 'task_count':
        return userStats?.tasksCompleted || 0;
      
      case 'habit_streak':
        return activityData.currentStreak || userStats?.longestStreak || 0;
      
      case 'goal_completion':
        return userStats?.goalsCompleted || 0;
      
      case 'level_reached':
        return userStats?.level || 0;
      
      case 'xp_earned':
        return userStats?.totalXP || 0;
      
      case 'consecutive_days':
        return userStats?.consecutiveDays || 0;
      
      default:
        return 0;
    }
  }

  /**
   * Seed default achievements
   */
  async seedDefaultAchievements(): Promise<Achievement[]> {
    const defaultAchievements: NewAchievement[] = [
      // Task achievements
      {
        name: 'First Steps',
        description: 'Complete your first task',
        icon: '✅',
        category: 'tasks',
        rarity: 'common',
        xpReward: 25,
        criteria: {
          type: 'task_count',
          target: 1,
        },
        unlockedItems: ['task-badge-bronze'],
        sortOrder: 1,
      },
      {
        name: 'Task Master',
        description: 'Complete 100 tasks',
        icon: '🏆',
        category: 'tasks',
        rarity: 'rare',
        xpReward: 100,
        criteria: {
          type: 'task_count',
          target: 100,
        },
        unlockedItems: ['task-badge-gold', 'productivity-crown'],
        sortOrder: 2,
      },
      
      // Habit achievements
      {
        name: 'Habit Starter',
        description: 'Maintain a 7-day habit streak',
        icon: '🔥',
        category: 'habits',
        rarity: 'common',
        xpReward: 50,
        criteria: {
          type: 'habit_streak',
          target: 7,
        },
        unlockedItems: ['streak-badge-bronze'],
        sortOrder: 3,
      },
      {
        name: 'Streak Legend',
        description: 'Maintain a 100-day habit streak',
        icon: '🌟',
        category: 'habits',
        rarity: 'legendary',
        xpReward: 500,
        criteria: {
          type: 'habit_streak',
          target: 100,
        },
        unlockedItems: ['streak-badge-legendary', 'flame-aura'],
        sortOrder: 4,
      },
      
      // Level achievements
      {
        name: 'Level Up!',
        description: 'Reach level 10',
        icon: '⬆️',
        category: 'levels',
        rarity: 'common',
        xpReward: 75,
        criteria: {
          type: 'level_reached',
          target: 10,
        },
        unlockedItems: ['level-badge-10'],
        sortOrder: 5,
      },
      {
        name: 'Elite Player',
        description: 'Reach level 50',
        icon: '👑',
        category: 'levels',
        rarity: 'epic',
        xpReward: 300,
        criteria: {
          type: 'level_reached',
          target: 50,
        },
        unlockedItems: ['elite-crown', 'golden-aura'],
        sortOrder: 6,
      },
      
      // Goal achievements
      {
        name: 'Goal Getter',
        description: 'Complete your first goal',
        icon: '🎯',
        category: 'goals',
        rarity: 'common',
        xpReward: 100,
        criteria: {
          type: 'goal_completion',
          target: 1,
        },
        unlockedItems: ['goal-badge-bronze'],
        sortOrder: 7,
      },
      
      // Special achievements
      {
        name: 'Early Bird',
        description: 'Complete 30 consecutive days of activity',
        icon: '🌅',
        category: 'special',
        rarity: 'rare',
        xpReward: 200,
        criteria: {
          type: 'consecutive_days',
          target: 30,
        },
        unlockedItems: ['early-bird-badge', 'sunrise-theme'],
        sortOrder: 8,
      },
      {
        name: 'XP Collector',
        description: 'Earn 10,000 total XP',
        icon: '💎',
        category: 'special',
        rarity: 'epic',
        xpReward: 250,
        criteria: {
          type: 'xp_earned',
          target: 10000,
        },
        unlockedItems: ['xp-collector-badge', 'diamond-effect'],
        sortOrder: 9,
      },
    ];

    return await this.achievementRepository.bulkCreateAchievements(defaultAchievements);
  }

  /**
   * Get achievements by category
   */
  async getAchievementsByCategory(category: string): Promise<Achievement[]> {
    return await this.achievementRepository.getAchievementsByCategory(category);
  }

  /**
   * Get achievements by rarity
   */
  async getAchievementsByRarity(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Promise<Achievement[]> {
    return await this.achievementRepository.getAchievementsByRarity(rarity);
  }

  /**
   * Get user's achievement completion rate
   */
  async getUserCompletionRate(userId: string): Promise<number> {
    const stats = await this.getUserAchievementStats(userId);
    return stats.completionRate;
  }

  /**
   * Get recent achievement unlocks for user
   */
  async getRecentUnlocks(userId: string, limit: number = 5): Promise<Array<{
    achievementId: string;
    name: string;
    unlockedAt: string;
  }>> {
    const stats = await this.getUserAchievementStats(userId);
    return stats.recentUnlocks.slice(0, limit);
  }

  /**
   * Check specific achievement progress
   */
  async getAchievementProgress(userId: string, achievementId: string): Promise<AchievementProgress | null> {
    return await this.achievementRepository.getAchievementProgress(userId, achievementId);
  }

  /**
   * Force unlock achievement (admin function)
   */
  async forceUnlockAchievement(userId: string, achievementId: string, notes?: string): Promise<AchievementUnlockResult | null> {
    return await this.unlockAchievement(userId, achievementId, {
      userId,
      activityType: 'custom',
      activityData: { forced: true, notes },
    });
  }
}