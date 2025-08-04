import { UserRepository } from '../repositories/UserRepository';
import { User } from '../db/schema/users';
import { z } from 'zod';

// XP configuration schema
export const xpConfigSchema = z.object({
  taskXP: z.object({
    low: z.number().min(1).default(10),
    medium: z.number().min(1).default(20),
    high: z.number().min(1).default(35),
    urgent: z.number().min(1).default(50),
  }).default({
    low: 10,
    medium: 20,
    high: 35,
    urgent: 50,
  }),
  habitXP: z.object({
    daily: z.number().min(1).default(15),
    weekly: z.number().min(1).default(25),
    streak_bonus: z.number().min(0).default(5), // Bonus per streak milestone
    streak_milestone: z.number().min(1).default(7), // Days for streak bonus
  }).default({
    daily: 15,
    weekly: 25,
    streak_bonus: 5,
    streak_milestone: 7,
  }),
  goalXP: z.object({
    milestone: z.number().min(1).default(30),
    completion: z.number().min(1).default(100),
    bonus_multiplier: z.number().min(1).default(1.5), // Bonus for early completion
  }).default({
    milestone: 30,
    completion: 100,
    bonus_multiplier: 1.5,
  }),
  levelingXP: z.object({
    base_requirement: z.number().min(1).default(100),
    growth_factor: z.number().min(1).default(1.2), // XP requirement growth per level
    max_level: z.number().min(1).default(100),
  }).default({
    base_requirement: 100,
    growth_factor: 1.2,
    max_level: 100,
  }),
});

// XP award types
export const xpAwardTypeEnum = ['task', 'habit', 'goal_milestone', 'goal_completion', 'achievement', 'streak_bonus'] as const;

// XP award schema
export const xpAwardSchema = z.object({
  type: z.enum(xpAwardTypeEnum),
  amount: z.number().min(1),
  reason: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export type XPConfig = z.infer<typeof xpConfigSchema>;
export type XPAwardType = typeof xpAwardTypeEnum[number];
export type XPAward = z.infer<typeof xpAwardSchema>;

export interface LevelInfo {
  level: number;
  currentXP: number;
  nextLevelXP: number;
  totalXP: number;
  progressToNext: number; // Percentage 0-100
  isMaxLevel: boolean;
}

export interface XPAwardResult {
  xpAwarded: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  newLevelInfo: LevelInfo;
  unlockedRewards?: string[];
}

export class ExperienceService {
  private userRepository: UserRepository;
  private xpConfig: XPConfig;

  constructor(customConfig?: Partial<XPConfig>) {
    this.userRepository = new UserRepository();
    this.xpConfig = xpConfigSchema.parse(customConfig || {});
  }

  /**
   * Calculate XP requirement for a specific level
   */
  calculateXPRequirement(level: number): number {
    if (level <= 1) return 0;
    if (level > this.xpConfig.levelingXP.max_level) {
      return this.calculateXPRequirement(this.xpConfig.levelingXP.max_level);
    }

    const { base_requirement, growth_factor } = this.xpConfig.levelingXP;
    return Math.floor(base_requirement * Math.pow(growth_factor, level - 2));
  }

  /**
   * Calculate total XP needed to reach a specific level
   */
  calculateTotalXPForLevel(level: number): number {
    let totalXP = 0;
    for (let i = 2; i <= level; i++) {
      totalXP += this.calculateXPRequirement(i);
    }
    return totalXP;
  }

  /**
   * Calculate level from total XP
   */
  calculateLevelFromXP(totalXP: number): LevelInfo {
    let level = 1;
    let xpUsed = 0;

    // Find the current level
    while (level < this.xpConfig.levelingXP.max_level) {
      const nextLevelXP = this.calculateXPRequirement(level + 1);
      if (xpUsed + nextLevelXP > totalXP) {
        break;
      }
      xpUsed += nextLevelXP;
      level++;
    }

    const currentXP = totalXP - xpUsed;
    const nextLevelXP = level < this.xpConfig.levelingXP.max_level 
      ? this.calculateXPRequirement(level + 1) 
      : 0;
    
    const progressToNext = nextLevelXP > 0 
      ? Math.round((currentXP / nextLevelXP) * 100)
      : 100;

    return {
      level,
      currentXP,
      nextLevelXP,
      totalXP,
      progressToNext,
      isMaxLevel: level >= this.xpConfig.levelingXP.max_level,
    };
  }

  /**
   * Get current level information for a user
   */
  async getUserLevelInfo(userId: string): Promise<LevelInfo | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;

    return this.calculateLevelFromXP(user.totalXP);
  }

  /**
   * Calculate XP for task completion
   */
  calculateTaskXP(priority: 'low' | 'medium' | 'high' | 'urgent', metadata?: Record<string, any>): number {
    let baseXP = this.xpConfig.taskXP[priority];
    
    // Apply any bonuses based on metadata
    if (metadata?.isOverdue) {
      baseXP = Math.floor(baseXP * 0.8); // Reduced XP for overdue tasks
    }
    
    if (metadata?.completedEarly) {
      baseXP = Math.floor(baseXP * 1.2); // Bonus for early completion
    }

    return Math.max(1, baseXP);
  }

  /**
   * Calculate XP for habit completion
   */
  calculateHabitXP(frequency: 'daily' | 'weekly', currentStreak: number = 0, metadata?: Record<string, any>): number {
    let baseXP = frequency === 'daily' 
      ? this.xpConfig.habitXP.daily 
      : this.xpConfig.habitXP.weekly;

    // Add streak bonus
    const streakMilestones = Math.floor(currentStreak / this.xpConfig.habitXP.streak_milestone);
    const streakBonus = streakMilestones * this.xpConfig.habitXP.streak_bonus;
    
    return baseXP + streakBonus;
  }

  /**
   * Calculate XP for goal milestone completion
   */
  calculateGoalMilestoneXP(metadata?: Record<string, any>): number {
    let baseXP = this.xpConfig.goalXP.milestone;
    
    if (metadata?.completedEarly) {
      baseXP = Math.floor(baseXP * this.xpConfig.goalXP.bonus_multiplier);
    }

    return baseXP;
  }

  /**
   * Calculate XP for goal completion
   */
  calculateGoalCompletionXP(milestoneCount: number = 1, metadata?: Record<string, any>): number {
    let baseXP = this.xpConfig.goalXP.completion;
    
    // Scale with milestone count
    baseXP = Math.floor(baseXP * Math.sqrt(milestoneCount));
    
    if (metadata?.completedEarly) {
      baseXP = Math.floor(baseXP * this.xpConfig.goalXP.bonus_multiplier);
    }

    return baseXP;
  }

  /**
   * Award XP to a user
   */
  async awardXP(userId: string, award: XPAward): Promise<XPAwardResult | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;

    // Validate XP award
    const validatedAward = xpAwardSchema.parse(award);
    
    // Calculate previous level info
    const previousLevelInfo = this.calculateLevelFromXP(user.totalXP);
    
    // Calculate new totals
    const newTotalXP = user.totalXP + validatedAward.amount;
    const newLevelInfo = this.calculateLevelFromXP(newTotalXP);
    
    // Check if user leveled up
    const leveledUp = newLevelInfo.level > previousLevelInfo.level;
    
    // Update user in database
    const updatedUser = await this.userRepository.update(userId, {
      totalXP: newTotalXP,
      level: newLevelInfo.level,
      currentLevelXP: newLevelInfo.currentXP,
      nextLevelXP: newLevelInfo.nextLevelXP,
    });

    if (!updatedUser) return null;

    // Determine unlocked rewards for level up
    let unlockedRewards: string[] = [];
    if (leveledUp) {
      unlockedRewards = this.getLevelUpRewards(newLevelInfo.level);
      
      // Add unlocked items to user
      if (unlockedRewards.length > 0) {
        const currentUnlocked = user.unlockedItems || [];
        const newUnlocked = [...new Set([...currentUnlocked, ...unlockedRewards])];
        await this.userRepository.update(userId, {
          unlockedItems: newUnlocked,
        });
      }
    }

    return {
      xpAwarded: validatedAward.amount,
      previousLevel: previousLevelInfo.level,
      newLevel: newLevelInfo.level,
      leveledUp,
      newLevelInfo,
      unlockedRewards: leveledUp ? unlockedRewards : undefined,
    };
  }

  /**
   * Award XP for task completion
   */
  async awardTaskXP(
    userId: string, 
    priority: 'low' | 'medium' | 'high' | 'urgent',
    taskTitle: string,
    metadata?: Record<string, any>
  ): Promise<XPAwardResult | null> {
    const xpAmount = this.calculateTaskXP(priority, metadata);
    
    return await this.awardXP(userId, {
      type: 'task',
      amount: xpAmount,
      reason: `Completed task: ${taskTitle}`,
      metadata: { priority, ...metadata },
    });
  }

  /**
   * Award XP for habit completion
   */
  async awardHabitXP(
    userId: string,
    frequency: 'daily' | 'weekly',
    habitName: string,
    currentStreak: number = 0,
    metadata?: Record<string, any>
  ): Promise<XPAwardResult | null> {
    const xpAmount = this.calculateHabitXP(frequency, currentStreak, metadata);
    
    return await this.awardXP(userId, {
      type: 'habit',
      amount: xpAmount,
      reason: `Completed habit: ${habitName}`,
      metadata: { frequency, currentStreak, ...metadata },
    });
  }

  /**
   * Award XP for goal milestone completion
   */
  async awardGoalMilestoneXP(
    userId: string,
    milestoneName: string,
    metadata?: Record<string, any>
  ): Promise<XPAwardResult | null> {
    const xpAmount = this.calculateGoalMilestoneXP(metadata);
    
    return await this.awardXP(userId, {
      type: 'goal_milestone',
      amount: xpAmount,
      reason: `Completed milestone: ${milestoneName}`,
      metadata,
    });
  }

  /**
   * Award XP for goal completion
   */
  async awardGoalCompletionXP(
    userId: string,
    goalName: string,
    milestoneCount: number = 1,
    metadata?: Record<string, any>
  ): Promise<XPAwardResult | null> {
    const xpAmount = this.calculateGoalCompletionXP(milestoneCount, metadata);
    
    return await this.awardXP(userId, {
      type: 'goal_completion',
      amount: xpAmount,
      reason: `Completed goal: ${goalName}`,
      metadata: { milestoneCount, ...metadata },
    });
  }

  /**
   * Get rewards unlocked at a specific level
   */
  getLevelUpRewards(level: number): string[] {
    const rewards: string[] = [];
    
    // Define level-based rewards
    const levelRewards: Record<number, string[]> = {
      2: ['bronze-badge'],
      5: ['warrior-avatar', 'basic-sword'],
      10: ['silver-badge', 'shield'],
      15: ['mage-avatar', 'staff'],
      20: ['gold-badge', 'advanced-sword'],
      25: ['rogue-avatar', 'daggers'],
      30: ['platinum-badge', 'magic-cloak'],
      40: ['dragon-avatar', 'dragon-sword'],
      50: ['diamond-badge', 'legendary-armor'],
      75: ['phoenix-avatar', 'phoenix-wings'],
      100: ['master-badge', 'ultimate-weapon'],
    };

    return levelRewards[level] || [];
  }

  /**
   * Get XP configuration
   */
  getXPConfig(): XPConfig {
    return this.xpConfig;
  }

  /**
   * Update XP configuration
   */
  updateXPConfig(newConfig: Partial<XPConfig>): void {
    this.xpConfig = xpConfigSchema.parse({ ...this.xpConfig, ...newConfig });
  }

  /**
   * Get leaderboard data (top users by level and XP)
   */
  async getLeaderboard(limit: number = 10): Promise<Array<{
    userId: string;
    username: string;
    level: number;
    totalXP: number;
    rank: number;
  }>> {
    // This would require a more complex query - for now return empty array
    // In a real implementation, you'd query the database for top users
    return [];
  }

  /**
   * Simulate XP progression for testing
   */
  simulateProgression(startingXP: number, xpToAdd: number): {
    startLevel: LevelInfo;
    endLevel: LevelInfo;
    levelsGained: number;
    rewardsUnlocked: string[];
  } {
    const startLevel = this.calculateLevelFromXP(startingXP);
    const endLevel = this.calculateLevelFromXP(startingXP + xpToAdd);
    
    const levelsGained = endLevel.level - startLevel.level;
    const rewardsUnlocked: string[] = [];
    
    // Collect all rewards for levels gained
    for (let level = startLevel.level + 1; level <= endLevel.level; level++) {
      rewardsUnlocked.push(...this.getLevelUpRewards(level));
    }
    
    return {
      startLevel,
      endLevel,
      levelsGained,
      rewardsUnlocked,
    };
  }
}