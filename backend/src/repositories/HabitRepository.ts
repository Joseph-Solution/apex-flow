import { eq, and, desc, asc, sql, count, or, gte, lte, between } from 'drizzle-orm';
import { db } from '../db/connection';
import { habits, habitCompletions } from '../db/schema/habits';
import { Habit, NewHabit, UpdateHabit, HabitCompletion, NewHabitCompletion, HabitFilter } from '../models/Habit';

export class HabitRepository {
  /**
   * Create a new habit
   */
  async create(habitData: NewHabit): Promise<Habit> {
    const [habit] = await db.insert(habits).values(habitData).returning();
    return habit;
  }

  /**
   * Find habit by ID
   */
  async findById(id: string): Promise<Habit | null> {
    const [habit] = await db.select().from(habits).where(eq(habits.id, id));
    return habit || null;
  }

  /**
   * Find habit by ID and user ID
   */
  async findByIdAndUserId(id: string, userId: string): Promise<Habit | null> {
    const [habit] = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)));
    return habit || null;
  }

  /**
   * Find all habits for a user with filtering, sorting, and pagination
   */
  async findByUserId(
    userId: string,
    options: {
      filter?: HabitFilter;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ habits: Habit[]; total: number }> {
    const { filter = {}, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = options;
    
    // Build where conditions
    const conditions = [eq(habits.userId, userId)];
    
    if (filter.category) {
      conditions.push(eq(habits.category, filter.category));
    }
    
    if (filter.frequency) {
      conditions.push(eq(habits.frequency, filter.frequency));
    }
    
    if (filter.isActive !== undefined) {
      conditions.push(eq(habits.isActive, filter.isActive));
    }
    
    if (filter.isPaused !== undefined) {
      conditions.push(eq(habits.isPaused, filter.isPaused));
    }

    const whereClause = and(...conditions);
    
    // Build order by clause
    const direction = sortOrder === 'desc' ? desc : asc;
    let orderBy;
    
    switch (sortBy) {
      case 'name':
        orderBy = direction(habits.name);
        break;
      case 'currentStreak':
        orderBy = direction(habits.currentStreak);
        break;
      case 'longestStreak':
        orderBy = direction(habits.longestStreak);
        break;
      case 'lastCompletedAt':
        orderBy = direction(habits.lastCompletedAt);
        break;
      case 'createdAt':
      default:
        orderBy = direction(habits.createdAt);
        break;
    }

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(habits)
      .where(whereClause);

    // Get paginated results
    const offset = (page - 1) * limit;
    const habitResults = await db
      .select()
      .from(habits)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      habits: habitResults,
      total: Number(total)
    };
  }

  /**
   * Update a habit
   */
  async update(id: string, userId: string, updates: UpdateHabit): Promise<Habit | null> {
    const processedUpdates: any = { ...updates, updatedAt: new Date() };
    
    const [habit] = await db
      .update(habits)
      .set(processedUpdates)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)))
      .returning();
    return habit || null;
  }

  /**
   * Delete a habit
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)));
    return result.length > 0;
  }

  /**
   * Update habit streak information
   */
  async updateStreakInfo(
    id: string, 
    userId: string, 
    streakData: {
      currentStreak: number;
      longestStreak?: number;
      totalCompletions: number;
      lastCompletedAt: Date;
    }
  ): Promise<Habit | null> {
    const updateData: any = {
      currentStreak: streakData.currentStreak,
      totalCompletions: streakData.totalCompletions,
      lastCompletedAt: streakData.lastCompletedAt,
      updatedAt: new Date()
    };

    if (streakData.longestStreak !== undefined) {
      updateData.longestStreak = streakData.longestStreak;
    }

    const [habit] = await db
      .update(habits)
      .set(updateData)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)))
      .returning();
    return habit || null;
  }

  /**
   * Pause or unpause a habit
   */
  async togglePause(id: string, userId: string, isPaused: boolean, reason?: string): Promise<Habit | null> {
    const updateData: any = {
      isPaused,
      updatedAt: new Date()
    };

    if (isPaused) {
      updateData.pausedAt = new Date();
      updateData.pauseReason = reason;
    } else {
      updateData.pausedAt = null;
      updateData.pauseReason = null;
    }

    const [habit] = await db
      .update(habits)
      .set(updateData)
      .where(and(eq(habits.id, id), eq(habits.userId, userId)))
      .returning();
    return habit || null;
  }

  /**
   * Get habit statistics for a user
   */
  async getHabitStats(userId: string): Promise<{
    total: number;
    active: number;
    paused: number;
    totalCompletions: number;
    averageStreak: number;
    longestOverallStreak: number;
  }> {
    const stats = await db
      .select({
        total: count(),
        active: count(sql`CASE WHEN ${habits.isActive} = true AND ${habits.isPaused} = false THEN 1 END`),
        paused: count(sql`CASE WHEN ${habits.isPaused} = true THEN 1 END`),
        totalCompletions: sql<number>`COALESCE(SUM(${habits.totalCompletions}), 0)`,
        averageStreak: sql<number>`COALESCE(AVG(${habits.currentStreak}), 0)`,
        longestOverallStreak: sql<number>`COALESCE(MAX(${habits.longestStreak}), 0)`
      })
      .from(habits)
      .where(eq(habits.userId, userId));

    const result = stats[0];
    
    return {
      total: Number(result.total),
      active: Number(result.active),
      paused: Number(result.paused),
      totalCompletions: Number(result.totalCompletions),
      averageStreak: Math.round(Number(result.averageStreak) * 100) / 100,
      longestOverallStreak: Number(result.longestOverallStreak)
    };
  }

  /**
   * Get habits that need reminders (based on reminder time and days)
   */
  async getHabitsForReminders(userId: string, currentTime: string, currentDay: number): Promise<Habit[]> {
    return await db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.userId, userId),
          eq(habits.isActive, true),
          eq(habits.isPaused, false),
          eq(habits.reminderTime, currentTime),
          sql`${habits.reminderDays} @> ${JSON.stringify([currentDay])}`
        )
      );
  }

  // Habit Completion methods

  /**
   * Create a habit completion record
   */
  async createCompletion(completionData: NewHabitCompletion): Promise<HabitCompletion> {
    const [completion] = await db.insert(habitCompletions).values(completionData).returning();
    return completion;
  }

  /**
   * Find completion by habit ID and date
   */
  async findCompletionByDate(habitId: string, userId: string, date: string): Promise<HabitCompletion | null> {
    const [completion] = await db
      .select()
      .from(habitCompletions)
      .where(
        and(
          eq(habitCompletions.habitId, habitId),
          eq(habitCompletions.userId, userId),
          eq(habitCompletions.completedDate, date)
        )
      );
    return completion || null;
  }

  /**
   * Get habit completions for a date range
   */
  async getCompletionsInRange(
    habitId: string, 
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<HabitCompletion[]> {
    return await db
      .select()
      .from(habitCompletions)
      .where(
        and(
          eq(habitCompletions.habitId, habitId),
          eq(habitCompletions.userId, userId),
          gte(habitCompletions.completedDate, startDate),
          lte(habitCompletions.completedDate, endDate)
        )
      )
      .orderBy(asc(habitCompletions.completedDate));
  }

  /**
   * Get all completions for a habit
   */
  async getHabitCompletions(habitId: string, userId: string): Promise<HabitCompletion[]> {
    return await db
      .select()
      .from(habitCompletions)
      .where(
        and(
          eq(habitCompletions.habitId, habitId),
          eq(habitCompletions.userId, userId)
        )
      )
      .orderBy(desc(habitCompletions.completedDate));
  }

  /**
   * Get completion count for a habit in a specific period
   */
  async getCompletionCount(
    habitId: string, 
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(habitCompletions)
      .where(
        and(
          eq(habitCompletions.habitId, habitId),
          eq(habitCompletions.userId, userId),
          gte(habitCompletions.completedDate, startDate),
          lte(habitCompletions.completedDate, endDate)
        )
      );
    
    return Number(result.count);
  }

  /**
   * Get recent completions for all user habits (for dashboard)
   */
  async getRecentCompletions(userId: string, days: number = 7): Promise<HabitCompletion[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    return await db
      .select()
      .from(habitCompletions)
      .where(
        and(
          eq(habitCompletions.userId, userId),
          gte(habitCompletions.completedDate, startDateStr)
        )
      )
      .orderBy(desc(habitCompletions.completedDate));
  }

  /**
   * Delete a habit completion
   */
  async deleteCompletion(habitId: string, userId: string, date: string): Promise<boolean> {
    const result = await db
      .delete(habitCompletions)
      .where(
        and(
          eq(habitCompletions.habitId, habitId),
          eq(habitCompletions.userId, userId),
          eq(habitCompletions.completedDate, date)
        )
      );
    return result.length > 0;
  }
}