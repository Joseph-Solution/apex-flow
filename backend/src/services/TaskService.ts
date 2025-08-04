import { TaskRepository } from '../repositories/TaskRepository';
import { ExperienceService } from './ExperienceService';
import { 
  Task, 
  NewTask, 
  UpdateTask, 
  CreateTaskRequest, 
  UpdateTaskRequest,
  TaskQuery,
  TaskStats,
  CompleteTask
} from '../models/Task';

export class TaskService {
  private taskRepository: TaskRepository;
  private experienceService: ExperienceService;

  constructor() {
    this.taskRepository = new TaskRepository();
    this.experienceService = new ExperienceService();
  }

  /**
   * Create a new task
   */
  async createTask(userId: string, taskData: CreateTaskRequest): Promise<Task> {
    // Calculate XP reward based on priority
    const xpReward = this.calculateXPReward(taskData.priority || 'medium');
    
    // Convert and prepare data for database
    const newTask: NewTask = {
      userId,
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority || 'medium',
      status: 'pending',
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
      estimatedDuration: taskData.estimatedDuration,
      xpReward,
      tags: taskData.tags || [],
      category: taskData.category,
      isRecurring: taskData.isRecurring || false,
      recurringConfig: taskData.recurringConfig as any,
      parentTaskId: taskData.parentTaskId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.taskRepository.create(newTask);
  }

  /**
   * Get task by ID (user must own the task)
   */
  async getTaskById(id: string, userId: string): Promise<Task | null> {
    return await this.taskRepository.findByIdAndUserId(id, userId);
  }

  /**
   * Get tasks for a user with filtering, sorting, and pagination
   */
  async getTasks(userId: string, query: TaskQuery): Promise<{
    tasks: Task[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, sort, filter } = query;
    
    const result = await this.taskRepository.findByUserId(userId, {
      filter,
      sort,
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
   * Update a task
   */
  async updateTask(id: string, userId: string, updates: UpdateTaskRequest): Promise<Task | null> {
    // Check if task exists and belongs to user
    const existingTask = await this.taskRepository.findByIdAndUserId(id, userId);
    if (!existingTask) {
      return null;
    }

    // Recalculate XP reward if priority changed
    let updateData = { ...updates };
    if (updates.priority && updates.priority !== existingTask.priority) {
      updateData.xpReward = this.calculateXPReward(updates.priority);
    }

    return await this.taskRepository.update(id, userId, updateData);
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string, userId: string): Promise<boolean> {
    return await this.taskRepository.delete(id, userId);
  }

  /**
   * Complete a task and award XP
   */
  async completeTask(id: string, userId: string, completionData: CompleteTask): Promise<{
    task: Task;
    xpAwarded: number;
  } | null> {
    // Check if task exists and belongs to user
    const existingTask = await this.taskRepository.findByIdAndUserId(id, userId);
    if (!existingTask) {
      return null;
    }

    // Check if task is already completed
    if (existingTask.status === 'completed') {
      throw new Error('Task is already completed');
    }

    // Mark task as completed
    const completedTask = await this.taskRepository.markCompleted(id, userId, completionData);
    if (!completedTask) {
      return null;
    }

    // Calculate bonus XP for early completion
    let bonusXP = 0;
    if (completedTask.dueDate) {
      const now = new Date();
      const dueDate = new Date(completedTask.dueDate);
      const timeDiff = dueDate.getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      // Award bonus XP for completing early (up to 50% bonus)
      if (daysDiff > 0) {
        bonusXP = Math.min(Math.floor(completedTask.xpReward * 0.1 * daysDiff), Math.floor(completedTask.xpReward * 0.5));
      }
    }

    // Update task with bonus XP if applicable
    if (bonusXP > 0) {
      await this.taskRepository.update(id, userId, { bonusXP });
    }

    // Award XP to user
    const totalXP = completedTask.xpReward + bonusXP;
    await this.experienceService.awardTaskXP(
      userId, 
      completedTask.priority as 'low' | 'medium' | 'high' | 'urgent',
      completedTask.title,
      {
        taskId: id,
        bonusXP,
        completedEarly: bonusXP > 0
      }
    );

    return {
      task: { ...completedTask, bonusXP },
      xpAwarded: totalXP
    };
  }

  /**
   * Get task statistics for a user
   */
  async getTaskStats(userId: string): Promise<TaskStats> {
    return await this.taskRepository.getTaskStats(userId);
  }

  /**
   * Get overdue tasks for a user
   */
  async getOverdueTasks(userId: string): Promise<Task[]> {
    return await this.taskRepository.getOverdueTasks(userId);
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(userId: string, status: string): Promise<Task[]> {
    return await this.taskRepository.getTasksByStatus(userId, status);
  }

  /**
   * Calculate XP reward based on task priority
   */
  private calculateXPReward(priority: string): number {
    const xpMap = {
      low: 10,
      medium: 25,
      high: 50,
      urgent: 100
    };
    return xpMap[priority as keyof typeof xpMap] || 25;
  }

  /**
   * Validate task ownership
   */
  async validateTaskOwnership(taskId: string, userId: string): Promise<boolean> {
    const task = await this.taskRepository.findByIdAndUserId(taskId, userId);
    return task !== null;
  }

  /**
   * Bulk update task status
   */
  async bulkUpdateStatus(taskIds: string[], userId: string, status: string): Promise<Task[]> {
    const updatedTasks: Task[] = [];
    
    for (const taskId of taskIds) {
      const task = await this.taskRepository.update(taskId, userId, { status: status as any });
      if (task) {
        updatedTasks.push(task);
      }
    }
    
    return updatedTasks;
  }

  /**
   * Get task completion rate for a user over a period
   */
  async getCompletionRate(userId: string, days: number = 30): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const result = await this.taskRepository.findByUserId(userId, {
      filter: {
        dueAfter: startDate.toISOString()
      }
    });
    
    const completedTasks = result.tasks.filter(task => task.status === 'completed').length;
    const totalTasks = result.total;
    
    return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  }
}