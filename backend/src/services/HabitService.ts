import { HabitRepository } from '../repositories/HabitRepository';
import { ExperienceService } from './ExperienceService';
import { 
  Habit, 
  NewHabit, 
  UpdateHabit,
  HabitCompletion,
  NewHabitCompletion,
  CreateHabitRequest, 
  UpdateHabitRequest,
  HabitQuery,
  CompleteHabitRequest,
  HabitFrequencyCalculation,
  HabitStreakAnalysis,
  HabitCompletionRate
} from '../models/Habit';

export class HabitService {
  private habitRepository: HabitRepository;
  private experienceService: ExperienceService;

  constructor() {
    this.habitRepository = new HabitRepository();
    this.experienceService = new ExperienceService();
  }

  /**
   * Create a new habit
   */
  async createHabit(userId: string, habitData: CreateHabitRequest): Promise<Habit> {
    // Calculate XP reward based on frequency and target streak
    const xpReward = this.calculateXPReward(habitData.frequency || 'daily', habitData.targetStreak || 30);
    
    // Prepare data for database
    const newHabit: NewHabit = {
      userId,
      name: habitData.name,
      description: habitData.description,
      category: habitData.category,
      icon: habitData.icon || '🎯',
      color: habitData.color || '#3B82F6',
      frequency: habitData.frequency || 'daily',
      customFrequency: habitData.customFrequency as any,
      targetStreak: habitData.targetStreak || 30,
      targetCompletionsPerWeek: habitData.targetCompletionsPerWeek,
      xpPerCompletion: xpReward,
      bonusXPStreak: Math.floor(xpReward * 0.5), // 50% bonus for streaks
      reminderTime: habitData.reminderTime,
      reminderDays: (habitData.reminderDays as number[]) || [],
      isActive: habitData.isActive !== false, // Default to true
      currentStreak: 0,
      longestStreak: 0,
      totalCompletions: 0,
      isPaused: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.habitRepository.create(newHabit);
  }

  /**
   * Get habit by ID (user must own the habit)
   */
  async getHabitById(id: string, userId: string): Promise<Habit | null> {
    return await this.habitRepository.findByIdAndUserId(id, userId);
  }

  /**
   * Get habits for a user with filtering, sorting, and pagination
   */
  async getHabits(userId: string, query: HabitQuery): Promise<{
    habits: Habit[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, sortBy, sortOrder, filter } = query;
    
    const result = await this.habitRepository.findByUserId(userId, {
      filter,
      sortBy,
      sortOrder,
      page,
      limit
    });

    const totalPages = Math.ceil(result.total / limit);

    return {
      ...result,
      page,
      limit,
      totalPages
    };
  }

  /**
   * Update a habit
   */
  async updateHabit(id: string, userId: string, updates: UpdateHabitRequest): Promise<Habit | null> {
    // Check if habit exists and belongs to user
    const existingHabit = await this.habitRepository.findByIdAndUserId(id, userId);
    if (!existingHabit) {
      return null;
    }

    // Recalculate XP reward if frequency or target changed
    let updateData = { ...updates };
    if (updates.frequency || updates.targetStreak) {
      const frequency = updates.frequency || existingHabit.frequency;
      const targetStreak = updates.targetStreak || existingHabit.targetStreak;
      updateData.xpPerCompletion = this.calculateXPReward(frequency, targetStreak);
      updateData.bonusXPStreak = Math.floor(updateData.xpPerCompletion * 0.5);
    }

    return await this.habitRepository.update(id, userId, updateData);
  }

  /**
   * Delete a habit
   */
  async deleteHabit(id: string, userId: string): Promise<boolean> {
    return await this.habitRepository.delete(id, userId);
  }

  /**
   * Complete a habit for a specific date and award XP
   */
  async completeHabit(id: string, userId: string, completionData: CompleteHabitRequest): Promise<{
    habit: Habit;
    completion: HabitCompletion;
    xpAwarded: number;
    bonusXPAwarded: number;
    streakUpdated: boolean;
  } | null> {
    // Check if habit exists and belongs to user
    const existingHabit = await this.habitRepository.findByIdAndUserId(id, userId);
    if (!existingHabit) {
      return null;
    }

    // Check if habit is active and not paused
    if (!existingHabit.isActive || existingHabit.isPaused) {
      throw new Error('Cannot complete a paused or inactive habit');
    }

    // Use provided date or today
    const completionDate = completionData.completedDate || new Date().toISOString().split('T')[0];
    
    // Check if already completed for this date
    const existingCompletion = await this.habitRepository.findCompletionByDate(id, userId, completionDate);
    if (existingCompletion) {
      throw new Error('Habit already completed for this date');
    }

    // Calculate new streak
    const streakInfo = await this.calculateStreakUpdate(existingHabit, completionDate);
    
    // Calculate XP rewards
    const baseXP = existingHabit.xpPerCompletion;
    // Only award bonus XP if streak is continuing (not reset)
    const bonusXP = (streakInfo.streakUpdated && streakInfo.newStreak > 1) ? (existingHabit.bonusXPStreak || 0) : 0;
    const totalXP = baseXP + bonusXP;

    // Create completion record
    const newCompletion: NewHabitCompletion = {
      habitId: id,
      userId,
      completedDate: completionDate,
      completedAt: new Date(),
      notes: completionData.notes,
      mood: completionData.mood,
      streakAtCompletion: streakInfo.newStreak,
      xpAwarded: baseXP,
      bonusXPAwarded: bonusXP,
      completionMethod: completionData.completionMethod || 'manual'
    };

    const completion = await this.habitRepository.createCompletion(newCompletion);

    // Update habit streak information
    const updatedHabit = await this.habitRepository.updateStreakInfo(id, userId, {
      currentStreak: streakInfo.newStreak,
      longestStreak: streakInfo.newLongestStreak,
      totalCompletions: existingHabit.totalCompletions + 1,
      lastCompletedAt: new Date()
    });

    if (!updatedHabit) {
      throw new Error('Failed to update habit streak information');
    }

    // Award XP to user
    await this.experienceService.awardHabitXP(
      userId,
      existingHabit.frequency as 'daily' | 'weekly',
      existingHabit.name,
      streakInfo.newStreak,
      {
        habitId: id,
        bonusXP,
        completionDate
      }
    );

    return {
      habit: updatedHabit,
      completion,
      xpAwarded: baseXP,
      bonusXPAwarded: bonusXP,
      streakUpdated: streakInfo.streakUpdated
    };
  }

  /**
   * Get habit completion history
   */
  async getHabitCompletions(habitId: string, userId: string): Promise<HabitCompletion[]> {
    // Verify ownership
    const habit = await this.habitRepository.findByIdAndUserId(habitId, userId);
    if (!habit) {
      return [];
    }

    return await this.habitRepository.getHabitCompletions(habitId, userId);
  }

  /**
   * Get habit completions for a date range
   */
  async getHabitCompletionsInRange(
    habitId: string, 
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<HabitCompletion[]> {
    // Verify ownership
    const habit = await this.habitRepository.findByIdAndUserId(habitId, userId);
    if (!habit) {
      return [];
    }

    return await this.habitRepository.getCompletionsInRange(habitId, userId, startDate, endDate);
  }

  /**
   * Calculate habit completion rate for a period
   */
  async getHabitCompletionRate(
    habitId: string, 
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<HabitCompletionRate | null> {
    // Verify ownership
    const habit = await this.habitRepository.findByIdAndUserId(habitId, userId);
    if (!habit) {
      return null;
    }

    // Calculate expected completions based on frequency
    const expectedCompletions = this.calculateExpectedCompletions(habit, startDate, endDate);
    
    // Get actual completions
    const actualCompletions = await this.habitRepository.getCompletionCount(
      habitId, 
      userId, 
      startDate, 
      endDate
    );

    const completionRate = expectedCompletions > 0 ? (actualCompletions / expectedCompletions) * 100 : 0;
    const missedDays = Math.max(0, expectedCompletions - actualCompletions);

    return {
      period: `${startDate} to ${endDate}`,
      completionRate: Math.round(completionRate * 100) / 100,
      expectedCompletions,
      actualCompletions,
      missedDays
    };
  }

  /**
   * Get habit streak analysis
   */
  async getHabitStreakAnalysis(habitId: string, userId: string): Promise<HabitStreakAnalysis | null> {
    // Verify ownership
    const habit = await this.habitRepository.findByIdAndUserId(habitId, userId);
    if (!habit) {
      return null;
    }

    // Get all completions to analyze streaks
    const completions = await this.habitRepository.getHabitCompletions(habitId, userId);
    
    // Calculate streak history
    const streakHistory = this.calculateStreakHistory(completions, habit.frequency);
    
    // Calculate statistics
    const streakLengths = streakHistory.map(s => s.length);
    const averageStreakLength = streakLengths.length > 0 
      ? streakLengths.reduce((sum, length) => sum + length, 0) / streakLengths.length 
      : 0;
    
    const streakBreaks = Math.max(0, streakHistory.length - 1);

    return {
      currentStreak: habit.currentStreak,
      longestStreak: habit.longestStreak,
      streakHistory,
      averageStreakLength: Math.round(averageStreakLength * 100) / 100,
      streakBreaks
    };
  }

  /**
   * Pause or unpause a habit
   */
  async toggleHabitPause(id: string, userId: string, isPaused: boolean, reason?: string): Promise<Habit | null> {
    return await this.habitRepository.togglePause(id, userId, isPaused, reason);
  }

  /**
   * Get habit statistics for a user
   */
  async getHabitStats(userId: string): Promise<any> {
    return await this.habitRepository.getHabitStats(userId);
  }

  /**
   * Get habits that need reminders
   */
  async getHabitsForReminders(userId: string, currentTime: string, currentDay: number): Promise<Habit[]> {
    return await this.habitRepository.getHabitsForReminders(userId, currentTime, currentDay);
  }

  /**
   * Check if habit should be completed today based on frequency
   */
  async shouldCompleteToday(habitId: string, userId: string, targetDate?: string): Promise<boolean> {
    const habit = await this.habitRepository.findByIdAndUserId(habitId, userId);
    if (!habit || !habit.isActive || habit.isPaused) {
      return false;
    }

    const checkDate = targetDate || new Date().toISOString().split('T')[0];
    
    return this.isCompletionDue(habit, checkDate);
  }

  /**
   * Calculate XP reward based on frequency and target streak
   */
  private calculateXPReward(frequency: string, targetStreak: number = 30): number {
    const baseXP = {
      daily: 15,
      weekly: 50,
      custom: 25
    };

    const frequencyXP = baseXP[frequency as keyof typeof baseXP] || 25;
    
    // Bonus XP for higher target streaks
    const streakBonus = Math.floor(targetStreak / 10) * 5;
    
    return Math.min(frequencyXP + streakBonus, 100); // Cap at 100 XP
  }

  /**
   * Calculate streak update when completing a habit
   */
  private async calculateStreakUpdate(habit: Habit, completionDate: string): Promise<{
    newStreak: number;
    newLongestStreak: number;
    streakUpdated: boolean;
  }> {
    const completionDateObj = new Date(completionDate);
    const lastCompletedAt = habit.lastCompletedAt ? new Date(habit.lastCompletedAt) : null;
    
    let newStreak = 1;
    let streakUpdated = true;
    
    if (lastCompletedAt) {
      const daysDiff = Math.floor((completionDateObj.getTime() - lastCompletedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (this.isConsecutiveCompletion(habit, daysDiff)) {
        newStreak = habit.currentStreak + 1;
      } else if (daysDiff === 0) {
        // Same day completion (shouldn't happen due to validation, but handle gracefully)
        newStreak = habit.currentStreak;
        streakUpdated = false;
      } else {
        // Streak broken, start new streak
        newStreak = 1;
      }
    }
    
    const newLongestStreak = Math.max(habit.longestStreak, newStreak);
    
    return {
      newStreak,
      newLongestStreak,
      streakUpdated
    };
  }

  /**
   * Check if completion maintains streak based on habit frequency
   */
  private isConsecutiveCompletion(habit: Habit, daysDiff: number): boolean {
    switch (habit.frequency) {
      case 'daily':
        return daysDiff === 1;
      case 'weekly':
        return daysDiff >= 1 && daysDiff <= 7;
      case 'custom':
        if (habit.customFrequency) {
          switch (habit.customFrequency.type) {
            case 'days_per_week':
            case 'times_per_week':
              return daysDiff >= 1 && daysDiff <= 7;
            case 'times_per_month':
              return daysDiff >= 1 && daysDiff <= 31;
          }
        }
        return daysDiff === 1; // Default to daily
      default:
        return daysDiff === 1;
    }
  }

  /**
   * Check if habit completion is due for a specific date
   */
  private isCompletionDue(habit: Habit, targetDate: string): boolean {
    const targetDateObj = new Date(targetDate);
    const dayOfWeek = targetDateObj.getDay(); // 0 = Sunday, 6 = Saturday
    
    switch (habit.frequency) {
      case 'daily':
        return true;
      case 'weekly':
        // Check if today is in the reminder days
        return habit.reminderDays?.includes(dayOfWeek) || false;
      case 'custom':
        if (habit.customFrequency) {
          switch (habit.customFrequency.type) {
            case 'days_per_week':
            case 'times_per_week':
              return habit.customFrequency.specificDays?.includes(dayOfWeek) || true;
            case 'times_per_month':
              return true; // Allow completion any day of the month
          }
        }
        return true;
      default:
        return true;
    }
  }

  /**
   * Calculate expected completions for a date range
   */
  private calculateExpectedCompletions(habit: Habit, startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    switch (habit.frequency) {
      case 'daily':
        return daysDiff;
      case 'weekly':
        const weeks = Math.ceil(daysDiff / 7);
        return weeks;
      case 'custom':
        if (habit.customFrequency) {
          switch (habit.customFrequency.type) {
            case 'days_per_week':
            case 'times_per_week':
              const weeksCustom = Math.ceil(daysDiff / 7);
              return weeksCustom * habit.customFrequency.value;
            case 'times_per_month':
              const months = Math.ceil(daysDiff / 30);
              return months * habit.customFrequency.value;
          }
        }
        return daysDiff; // Default to daily
      default:
        return daysDiff;
    }
  }

  /**
   * Calculate streak history from completions
   */
  private calculateStreakHistory(completions: HabitCompletion[], frequency: string): Array<{
    startDate: string;
    endDate: string;
    length: number;
  }> {
    if (completions.length === 0) return [];
    
    // Sort completions by date
    const sortedCompletions = completions.sort((a, b) => 
      new Date(a.completedDate).getTime() - new Date(b.completedDate).getTime()
    );
    
    const streaks: Array<{ startDate: string; endDate: string; length: number }> = [];
    let currentStreak = {
      startDate: sortedCompletions[0].completedDate,
      endDate: sortedCompletions[0].completedDate,
      length: 1
    };
    
    for (let i = 1; i < sortedCompletions.length; i++) {
      const current = new Date(sortedCompletions[i].completedDate);
      const previous = new Date(sortedCompletions[i - 1].completedDate);
      const daysDiff = Math.floor((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if this completion continues the streak
      const continuesStreak = this.isConsecutiveCompletionForHistory(frequency, daysDiff);
      
      if (continuesStreak) {
        currentStreak.endDate = sortedCompletions[i].completedDate;
        currentStreak.length++;
      } else {
        // End current streak and start new one
        streaks.push({ ...currentStreak });
        currentStreak = {
          startDate: sortedCompletions[i].completedDate,
          endDate: sortedCompletions[i].completedDate,
          length: 1
        };
      }
    }
    
    // Add the last streak
    streaks.push(currentStreak);
    
    return streaks;
  }

  /**
   * Check if completion continues streak for history calculation
   */
  private isConsecutiveCompletionForHistory(frequency: string, daysDiff: number): boolean {
    switch (frequency) {
      case 'daily':
        return daysDiff <= 2; // Allow 1-2 day gaps for daily habits
      case 'weekly':
        return daysDiff <= 14; // Allow up to 2 weeks gap
      case 'custom':
        return daysDiff <= 7; // Default to weekly tolerance
      default:
        return daysDiff <= 2;
    }
  }
}