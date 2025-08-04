import { eq, and, desc, asc, sql, count, or, lt, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { tasks } from '../db/schema/tasks';
import { Task, NewTask, UpdateTask, TaskFilter, TaskSort } from '../models/Task';

export class TaskRepository {
  /**
   * Create a new task
   */
  async create(taskData: NewTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData).returning();
    return task;
  }

  /**
   * Find task by ID
   */
  async findById(id: string): Promise<Task | null> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || null;
  }

  /**
   * Find task by ID and user ID
   */
  async findByIdAndUserId(id: string, userId: string): Promise<Task | null> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return task || null;
  }

  /**
   * Find all tasks for a user with filtering, sorting, and pagination
   */
  async findByUserId(
    userId: string,
    options: {
      filter?: TaskFilter;
      sort?: TaskSort;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ tasks: Task[]; total: number }> {
    const { filter = {}, sort, page = 1, limit = 20 } = options;
    
    // Build where conditions
    const conditions = [eq(tasks.userId, userId)];
    
    if (filter.status) {
      conditions.push(eq(tasks.status, filter.status));
    }
    
    if (filter.priority) {
      conditions.push(eq(tasks.priority, filter.priority));
    }
    
    if (filter.category) {
      conditions.push(eq(tasks.category, filter.category));
    }
    
    if (filter.dueBefore) {
      conditions.push(lt(tasks.dueDate, new Date(filter.dueBefore)));
    }
    
    if (filter.dueAfter) {
      conditions.push(gte(tasks.dueDate, new Date(filter.dueAfter)));
    }
    
    if (filter.isOverdue !== undefined) {
      const now = new Date();
      if (filter.isOverdue) {
        conditions.push(
          and(
            lt(tasks.dueDate, now),
            or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))
          )!
        );
      } else {
        conditions.push(
          or(
            gte(tasks.dueDate, now),
            eq(tasks.status, 'completed'),
            eq(tasks.status, 'cancelled')
          )!
        );
      }
    }
    
    if (filter.tags && filter.tags.length > 0) {
      // Use JSON contains operator for tags
      conditions.push(
        sql`${tasks.tags} @> ${JSON.stringify(filter.tags)}`
      );
    }

    const whereClause = and(...conditions);
    
    // Build order by clause
    let orderBy;
    if (sort) {
      const direction = sort.direction === 'desc' ? desc : asc;
      switch (sort.field) {
        case 'createdAt':
          orderBy = direction(tasks.createdAt);
          break;
        case 'updatedAt':
          orderBy = direction(tasks.updatedAt);
          break;
        case 'dueDate':
          orderBy = direction(tasks.dueDate);
          break;
        case 'priority':
          // Custom priority ordering: urgent > high > medium > low
          orderBy = sql`CASE 
            WHEN ${tasks.priority} = 'urgent' THEN 1
            WHEN ${tasks.priority} = 'high' THEN 2
            WHEN ${tasks.priority} = 'medium' THEN 3
            WHEN ${tasks.priority} = 'low' THEN 4
            ELSE 5
          END ${sort.direction === 'desc' ? sql`DESC` : sql`ASC`}`;
          break;
        case 'title':
          orderBy = direction(tasks.title);
          break;
        default:
          orderBy = desc(tasks.createdAt);
      }
    } else {
      // Default sorting: priority first, then due date, then created date
      orderBy = [
        sql`CASE 
          WHEN ${tasks.priority} = 'urgent' THEN 1
          WHEN ${tasks.priority} = 'high' THEN 2
          WHEN ${tasks.priority} = 'medium' THEN 3
          WHEN ${tasks.priority} = 'low' THEN 4
          ELSE 5
        END ASC`,
        asc(tasks.dueDate),
        desc(tasks.createdAt)
      ];
    }

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(tasks)
      .where(whereClause);

    // Get paginated results
    const offset = (page - 1) * limit;
    const taskResults = await db
      .select()
      .from(tasks)
      .where(whereClause)
      .orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
      .limit(limit)
      .offset(offset);

    return {
      tasks: taskResults,
      total: Number(total)
    };
  }

  /**
   * Update a task
   */
  async update(id: string, userId: string, updates: UpdateTask): Promise<Task | null> {
    // Convert string dates to Date objects if needed
    const processedUpdates: any = { ...updates };
    if (processedUpdates.dueDate && typeof processedUpdates.dueDate === 'string') {
      processedUpdates.dueDate = new Date(processedUpdates.dueDate);
    }
    
    const [task] = await db
      .update(tasks)
      .set({ ...processedUpdates, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning();
    return task || null;
  }

  /**
   * Delete a task
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return result.length > 0;
  }

  /**
   * Mark task as completed
   */
  async markCompleted(
    id: string, 
    userId: string, 
    completionData: { completionNotes?: string; actualDuration?: number }
  ): Promise<Task | null> {
    const [task] = await db
      .update(tasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completionNotes: completionData.completionNotes,
        actualDuration: completionData.actualDuration,
        updatedAt: new Date()
      })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning();
    return task || null;
  }

  /**
   * Get task statistics for a user
   */
  async getTaskStats(userId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    completionRate: number;
  }> {
    const now = new Date();
    
    const stats = await db
      .select({
        total: count(),
        completed: count(sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`),
        pending: count(sql`CASE WHEN ${tasks.status} = 'pending' THEN 1 END`),
        inProgress: count(sql`CASE WHEN ${tasks.status} = 'in_progress' THEN 1 END`),
        overdue: count(sql`CASE WHEN ${tasks.dueDate} < ${now} AND ${tasks.status} IN ('pending', 'in_progress') THEN 1 END`)
      })
      .from(tasks)
      .where(eq(tasks.userId, userId));

    const result = stats[0];
    const total = Number(result.total);
    const completed = Number(result.completed);
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      completed,
      pending: Number(result.pending),
      inProgress: Number(result.inProgress),
      overdue: Number(result.overdue),
      completionRate: Math.round(completionRate * 100) / 100
    };
  }

  /**
   * Get overdue tasks for a user
   */
  async getOverdueTasks(userId: string): Promise<Task[]> {
    const now = new Date();
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          lt(tasks.dueDate, now),
          or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))
        )
      )
      .orderBy(asc(tasks.dueDate));
  }

  /**
   * Get tasks by status for a user
   */
  async getTasksByStatus(userId: string, status: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, status as any)))
      .orderBy(desc(tasks.createdAt));
  }
}