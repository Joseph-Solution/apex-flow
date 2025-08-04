import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskService } from '../services/TaskService';
import { TaskRepository } from '../repositories/TaskRepository';
import { ExperienceService } from '../services/ExperienceService';

// Mock the dependencies
jest.mock('../repositories/TaskRepository');
jest.mock('../services/ExperienceService');

const MockedTaskRepository = TaskRepository as jest.MockedClass<typeof TaskRepository>;
const MockedExperienceService = ExperienceService as jest.MockedClass<typeof ExperienceService>;

describe('Task Filtering, Sorting, and Overdue Detection', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<TaskRepository>;
  let mockExperienceService: jest.Mocked<ExperienceService>;

  const testUserId = 'test-user-id';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked instances
    mockTaskRepository = new MockedTaskRepository() as jest.Mocked<TaskRepository>;
    mockExperienceService = new MockedExperienceService() as jest.Mocked<ExperienceService>;

    // Create service instance
    taskService = new TaskService();

    // Replace the private instances with mocks
    (taskService as any).taskRepository = mockTaskRepository;
    (taskService as any).experienceService = mockExperienceService;
  });

  describe('Task Filtering', () => {
    it('should filter tasks by status', async () => {
      const mockTasks = [
        { id: '1', title: 'Pending Task', status: 'pending' },
        { id: '2', title: 'Completed Task', status: 'completed' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: [mockTasks[0]] as any,
        total: 1
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        filter: { status: 'pending' }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: { status: 'pending' },
        sort: undefined,
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].status).toBe('pending');
    });

    it('should filter tasks by priority', async () => {
      const mockTasks = [
        { id: '1', title: 'High Priority Task', priority: 'high' },
        { id: '2', title: 'Low Priority Task', priority: 'low' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: [mockTasks[0]] as any,
        total: 1
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        filter: { priority: 'high' }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: { priority: 'high' },
        sort: undefined,
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].priority).toBe('high');
    });

    it('should filter tasks by category', async () => {
      const mockTasks = [
        { id: '1', title: 'Work Task', category: 'work' },
        { id: '2', title: 'Personal Task', category: 'personal' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: [mockTasks[0]] as any,
        total: 1
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        filter: { category: 'work' }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: { category: 'work' },
        sort: undefined,
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].category).toBe('work');
    });

    it('should filter tasks by tags', async () => {
      const mockTasks = [
        { id: '1', title: 'Tagged Task', tags: ['urgent', 'important'] },
        { id: '2', title: 'Other Task', tags: ['routine'] }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: [mockTasks[0]] as any,
        total: 1
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        filter: { tags: ['urgent'] }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: { tags: ['urgent'] },
        sort: undefined,
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].tags).toContain('urgent');
    });

    it('should filter tasks by due date range', async () => {
      const mockTasks = [
        { id: '1', title: 'Due Soon', dueDate: '2024-12-31T23:59:59.000Z' },
        { id: '2', title: 'Due Later', dueDate: '2025-06-30T23:59:59.000Z' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: [mockTasks[0]] as any,
        total: 1
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        filter: { 
          dueBefore: '2025-01-01T00:00:00.000Z',
          dueAfter: '2024-01-01T00:00:00.000Z'
        }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: { 
          dueBefore: '2025-01-01T00:00:00.000Z',
          dueAfter: '2024-01-01T00:00:00.000Z'
        },
        sort: undefined,
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(1);
    });

    it('should filter overdue tasks', async () => {
      const mockOverdueTasks = [
        { id: '1', title: 'Overdue Task 1', status: 'pending', dueDate: '2023-01-01' },
        { id: '2', title: 'Overdue Task 2', status: 'in_progress', dueDate: '2023-06-01' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockOverdueTasks as any,
        total: 2
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        filter: { isOverdue: true }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: { isOverdue: true },
        sort: undefined,
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(2);
    });

    it('should combine multiple filters', async () => {
      const mockTasks = [
        { id: '1', title: 'Filtered Task', status: 'pending', priority: 'high', category: 'work' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 1
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        filter: { 
          status: 'pending',
          priority: 'high',
          category: 'work'
        }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: { 
          status: 'pending',
          priority: 'high',
          category: 'work'
        },
        sort: undefined,
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(1);
    });
  });

  describe('Task Sorting', () => {
    it('should sort tasks by priority ascending', async () => {
      const mockTasks = [
        { id: '1', title: 'High Priority', priority: 'high' },
        { id: '2', title: 'Medium Priority', priority: 'medium' },
        { id: '3', title: 'Low Priority', priority: 'low' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 3
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        sort: { field: 'priority', direction: 'asc' }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: undefined,
        sort: { field: 'priority', direction: 'asc' },
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(3);
    });

    it('should sort tasks by due date descending', async () => {
      const mockTasks = [
        { id: '1', title: 'Due Later', dueDate: '2025-12-31' },
        { id: '2', title: 'Due Soon', dueDate: '2024-12-31' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 2
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        sort: { field: 'dueDate', direction: 'desc' }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: undefined,
        sort: { field: 'dueDate', direction: 'desc' },
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(2);
    });

    it('should sort tasks by creation date', async () => {
      const mockTasks = [
        { id: '1', title: 'Newer Task', createdAt: '2024-02-01' },
        { id: '2', title: 'Older Task', createdAt: '2024-01-01' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 2
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        sort: { field: 'createdAt', direction: 'desc' }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: undefined,
        sort: { field: 'createdAt', direction: 'desc' },
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(2);
    });

    it('should sort tasks by title alphabetically', async () => {
      const mockTasks = [
        { id: '1', title: 'Alpha Task' },
        { id: '2', title: 'Beta Task' },
        { id: '3', title: 'Gamma Task' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 3
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        sort: { field: 'title', direction: 'asc' }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: undefined,
        sort: { field: 'title', direction: 'asc' },
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(3);
    });
  });

  describe('Pagination', () => {
    it('should paginate results correctly', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1' },
        { id: '2', title: 'Task 2' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 25
      });

      const result = await taskService.getTasks(testUserId, {
        page: 2,
        limit: 10
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: undefined,
        sort: undefined,
        page: 2,
        limit: 10
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3); // Math.ceil(25/10)
    });

    it('should handle first page correctly', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1' },
        { id: '2', title: 'Task 2' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 15
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 5
      });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.total).toBe(15);
      expect(result.totalPages).toBe(3); // Math.ceil(15/5)
    });

    it('should handle empty results', async () => {
      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: [],
        total: 0
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 10
      });

      expect(result.tasks).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('Overdue Detection', () => {
    it('should get overdue tasks', async () => {
      const mockOverdueTasks = [
        { id: '1', title: 'Overdue Task 1', status: 'pending', dueDate: '2023-01-01' },
        { id: '2', title: 'Overdue Task 2', status: 'in_progress', dueDate: '2023-06-01' }
      ];

      mockTaskRepository.getOverdueTasks.mockResolvedValue(mockOverdueTasks as any);

      const result = await taskService.getOverdueTasks(testUserId);

      expect(mockTaskRepository.getOverdueTasks).toHaveBeenCalledWith(testUserId);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Overdue Task 1');
      expect(result[1].title).toBe('Overdue Task 2');
    });

    it('should return empty array when no overdue tasks', async () => {
      mockTaskRepository.getOverdueTasks.mockResolvedValue([]);

      const result = await taskService.getOverdueTasks(testUserId);

      expect(mockTaskRepository.getOverdueTasks).toHaveBeenCalledWith(testUserId);
      expect(result).toHaveLength(0);
    });
  });

  describe('Task Statistics', () => {
    it('should get task statistics including overdue count', async () => {
      const mockStats = {
        total: 10,
        completed: 6,
        pending: 3,
        inProgress: 1,
        overdue: 2,
        completionRate: 60
      };

      mockTaskRepository.getTaskStats.mockResolvedValue(mockStats);

      const result = await taskService.getTaskStats(testUserId);

      expect(mockTaskRepository.getTaskStats).toHaveBeenCalledWith(testUserId);
      expect(result).toEqual(mockStats);
      expect(result.overdue).toBe(2);
      expect(result.completionRate).toBe(60);
    });
  });

  describe('Combined Filtering and Sorting', () => {
    it('should apply both filtering and sorting', async () => {
      const mockTasks = [
        { id: '1', title: 'High Priority Pending', status: 'pending', priority: 'high' },
        { id: '2', title: 'Medium Priority Pending', status: 'pending', priority: 'medium' }
      ];

      mockTaskRepository.findByUserId.mockResolvedValue({
        tasks: mockTasks as any,
        total: 2
      });

      const result = await taskService.getTasks(testUserId, {
        page: 1,
        limit: 20,
        filter: { status: 'pending' },
        sort: { field: 'priority', direction: 'desc' }
      });

      expect(mockTaskRepository.findByUserId).toHaveBeenCalledWith(testUserId, {
        filter: { status: 'pending' },
        sort: { field: 'priority', direction: 'desc' },
        page: 1,
        limit: 20
      });

      expect(result.tasks).toHaveLength(2);
    });
  });
});