import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      user: { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() },
      course: { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() },
      assignment: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      quizAttempt: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      slide: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      slideProgress: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (ops: unknown) => Promise.all(ops as Promise<unknown>[])),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ReportsService);
  });

  describe('dashboard', () => {
    it('returns zeroed KPIs when empty', async () => {
      const result = await service.getDashboard();

      expect(result).toMatchObject({
        totalUsers: 0,
        totalAssignments: 0,
        completedAssignments: 0,
        completionRate: 0,
        averageBestScore: null,
        totalAttempts: 0,
      });
    });

    it('computes completion rate and average best score (best-attempt rule)', async () => {
      prisma.user.count.mockResolvedValue(10);
      prisma.course.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);
      prisma.assignment.count
        .mockResolvedValueOnce(4) // total
        .mockResolvedValueOnce(1); // overdue
      prisma.quizAttempt.findMany.mockResolvedValue([
        { userId: 'u1', courseId: 'c1', scorePercent: 60, passed: false },
        { userId: 'u1', courseId: 'c1', scorePercent: 90, passed: true },
        { userId: 'u2', courseId: 'c1', scorePercent: 70, passed: true },
        { userId: 'u3', courseId: 'c2', scorePercent: 50, passed: false },
      ]);

      const result = await service.getDashboard();

      expect(result).toMatchObject({
        totalUsers: 10,
        totalCourses: 5,
        publishedCourses: 3,
        totalAssignments: 4,
        completedAssignments: 2,
        completionRate: 50,
        overdueAssignments: 1,
        averageBestScore: 70,
        totalAttempts: 4,
      });
    });
  });

  describe('course report', () => {
    it('throws NotFound for a missing course', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.getCourseReport('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('classifies completed / in_progress / not_started / overdue', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Course' });
      prisma.assignment.findMany.mockResolvedValue([
        {
          id: 'a1',
          userId: 'u1',
          dueDate: null,
          user: { id: 'u1', fullName: 'Alice', department: { name: 'IT' } },
        },
        {
          id: 'a2',
          userId: 'u2',
          dueDate: null,
          user: { id: 'u2', fullName: 'Bob', department: null },
        },
        {
          id: 'a3',
          userId: 'u3',
          dueDate: null,
          user: { id: 'u3', fullName: 'Carol', department: { name: 'HR' } },
        },
        {
          id: 'a4',
          userId: 'u4',
          dueDate: new Date(Date.now() - 5 * 86_400_000),
          user: { id: 'u4', fullName: 'Dan', department: null },
        },
      ]);
      prisma.slide.count.mockResolvedValue(4);
      prisma.slideProgress.groupBy.mockResolvedValue([{ userId: 'u2', _count: { _all: 2 } }]);
      prisma.quizAttempt.findMany.mockResolvedValue([
        { userId: 'u1', scorePercent: 100, passed: true, submittedAt: new Date() },
      ]);

      const result = await service.getCourseReport('c1');

      expect(result.courseTitle).toBe('Course');
      expect(result.total).toBe(4);
      expect(result.completed).toBe(1);
      expect(result.inProgress).toBe(1);
      expect(result.notStarted).toBe(1);
      expect(result.overdue).toBe(1);
      expect(result.averageScore).toBe(100);
      expect(result.items.find((i) => i.userId === 'u4')?.status).toBe('overdue');
    });

    it('does not count passed users as overdue even past due date', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Course' });
      prisma.assignment.findMany.mockResolvedValue([
        {
          id: 'a1',
          userId: 'u1',
          dueDate: new Date(Date.now() - 30 * 86_400_000),
          user: { id: 'u1', fullName: 'Alice', department: null },
        },
      ]);
      prisma.slide.count.mockResolvedValue(2);
      prisma.slideProgress.groupBy.mockResolvedValue([]);
      prisma.quizAttempt.findMany.mockResolvedValue([
        { userId: 'u1', scorePercent: 90, passed: true, submittedAt: new Date() },
      ]);

      const result = await service.getCourseReport('c1');

      expect(result.items[0].status).toBe('completed');
      expect(result.overdue).toBe(0);
    });
  });

  describe('staff transcript', () => {
    it('throws NotFound for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getStaffTranscript('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('builds a transcript with statuses and counts', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        fullName: 'Alice',
        jobTitle: 'Engineer',
        department: { name: 'IT' },
      });
      prisma.assignment.findMany.mockResolvedValue([
        {
          dueDate: null,
          course: { id: 'c1', title: 'Done course', _count: { slides: 3 } },
        },
        {
          dueDate: new Date(Date.now() - 3 * 86_400_000),
          course: { id: 'c2', title: 'Overdue course', _count: { slides: 2 } },
        },
      ]);
      prisma.slideProgress.groupBy.mockResolvedValue([{ courseId: 'c1', _count: { _all: 3 } }]);
      prisma.quizAttempt.findMany.mockResolvedValue([
        { courseId: 'c1', scorePercent: 85, passed: true, submittedAt: new Date() },
      ]);

      const result = await service.getStaffTranscript('u1');

      expect(result).toMatchObject({
        fullName: 'Alice',
        departmentName: 'IT',
        assignedCourses: 2,
        completedCourses: 1,
      });
      expect(result.items[0]).toMatchObject({
        courseId: 'c1',
        status: 'completed',
        bestScore: 85,
      });
      expect(result.items[1].status).toBe('overdue');
    });
  });

  describe('overdue', () => {
    it('lists only overdue assignments not yet passed with day counts', async () => {
      const due = new Date(Date.now() - 10 * 86_400_000);
      prisma.assignment.findMany.mockResolvedValue([
        {
          id: 'a1',
          courseId: 'c1',
          userId: 'u1',
          dueDate: due,
          course: { title: 'Course A' },
          user: { fullName: 'Alice', department: { name: 'IT' } },
        },
        {
          id: 'a2',
          courseId: 'c2',
          userId: 'u2',
          dueDate: due,
          course: { title: 'Course B' },
          user: { fullName: 'Bob', department: null },
        },
      ]);
      prisma.slide.groupBy.mockResolvedValue([{ courseId: 'c1', _count: { _all: 4 } }]);
      prisma.slideProgress.groupBy.mockImplementation(async (args: { by?: string[] }) =>
        args.by && args.by.includes('userId') && args.by.length === 2
          ? [{ userId: 'u1', courseId: 'c1', _count: { _all: 4 } }]
          : [{ courseId: 'c1', _count: { _all: 4 } }],
      );
      prisma.quizAttempt.findMany.mockResolvedValue([{ userId: 'u2', courseId: 'c2' }]);

      const result = await service.getOverdue({});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        assignmentId: 'a1',
        fullName: 'Alice',
        slideCount: 4,
        slidesViewed: 4,
        daysOverdue: expect.any(Number),
      });
      expect(result[0].daysOverdue).toBeGreaterThanOrEqual(9);
    });
  });
});
