import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const course = { id: 'course-1' };
  const activeUser = {
    id: 'user-1',
    isActive: true,
    approvalStatus: 'approved',
  };

  beforeEach(async () => {
    prisma = {
      course: {
        findUnique: jest.fn().mockResolvedValue(course),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ title: 'Course' }),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      department: {
        findUnique: jest.fn(),
      },
      assignment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn(),
        update: jest.fn(),
      },
      slideProgress: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      quizAttempt: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { notifyCourseAssigned: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    service = moduleRef.get(AssignmentsService);
  });

  describe('create (individual)', () => {
    it('assigns a course to a single active approved user', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.assignment.findMany.mockResolvedValue([]);

      const result = await service.create('admin-1', {
        courseId: 'course-1',
        targetType: 'user',
        targetId: 'user-1',
      });

      expect(result).toEqual({ created: 1, skipped: 0 });
      expect(prisma.assignment.createMany).toHaveBeenCalledWith({
        data: [
          {
            courseId: 'course-1',
            userId: 'user-1',
            targetType: 'user',
            targetId: 'user-1',
            assignedById: 'admin-1',
            dueDate: null,
          },
        ],
      });
    });

    it('rejects a missing, inactive, or unapproved target user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create('admin-1', {
          courseId: 'course-1',
          targetType: 'user',
          targetId: 'nope',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when the course does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.create('admin-1', {
          courseId: 'nope',
          targetType: 'user',
          targetId: 'user-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create (department, materialized)', () => {
    it('creates one row per active approved member and skips duplicates', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 'dept-1' });
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);
      prisma.assignment.findMany.mockResolvedValue([{ userId: 'u2' }]);

      const result = await service.create('admin-1', {
        courseId: 'course-1',
        targetType: 'department',
        targetId: 'dept-1',
        dueDate: '2026-10-01T00:00:00.000Z',
      });

      expect(result).toEqual({ created: 2, skipped: 1 });
      expect(prisma.assignment.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ userId: 'u1', targetType: 'department' }),
          expect.objectContaining({ userId: 'u3', targetType: 'department' }),
        ],
      });
      const data = prisma.assignment.createMany.mock.calls[0][0].data;
      expect(data[0].dueDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    });

    it('rejects a department with no active approved members', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 'dept-1' });
      prisma.user.findMany.mockResolvedValue([]);
      await expect(
        service.create('admin-1', {
          courseId: 'course-1',
          targetType: 'department',
          targetId: 'dept-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('conflicts when every member already has the course', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 'dept-1' });
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      prisma.assignment.findMany.mockResolvedValue([{ userId: 'u1' }]);
      await expect(
        service.create('admin-1', {
          courseId: 'course-1',
          targetType: 'department',
          targetId: 'dept-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update/remove', () => {
    it('updates the due date', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.assignment.update.mockResolvedValue({ id: 'a1', dueDate: new Date('2026-12-01') });

      const result = await service.updateDueDate('a1', '2026-12-01T00:00:00.000Z');

      expect(result.dueDate).toEqual(new Date('2026-12-01'));
    });

    it('throws NotFound when updating a missing assignment', async () => {
      prisma.assignment.findUnique.mockResolvedValue(null);
      await expect(service.updateDueDate('nope', null)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes an assignment', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1' });
      await service.remove('a1');
      expect(prisma.assignment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    });

    it('throws NotFound when removing a missing assignment', async () => {
      prisma.assignment.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('myTraining', () => {
    it('maps assignments with progress and completion state', async () => {
      prisma.assignment.findMany.mockResolvedValue([
        {
          id: 'a1',
          courseId: 'course-1',
          dueDate: null,
          createdAt: new Date('2026-09-23'),
          course: {
            id: 'course-1',
            title: 'Security 101',
            description: null,
            _count: { slides: 4, questions: 10 },
          },
        },
        {
          id: 'a2',
          courseId: 'course-2',
          dueDate: new Date('2026-01-01'),
          createdAt: new Date('2026-09-23'),
          course: {
            id: 'course-2',
            title: 'Empty course',
            description: null,
            _count: { slides: 0, questions: 0 },
          },
        },
      ]);
      prisma.slideProgress.groupBy.mockResolvedValue([
        { courseId: 'course-1', _count: { _all: 4 } },
      ]);
      prisma.quizAttempt.findMany.mockResolvedValue([{ courseId: 'course-1' }]);

      const result = await service.myTraining('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        courseId: 'course-1',
        slideCount: 4,
        slidesViewed: 4,
        allSlidesViewed: true,
        quizQuestionCount: 10,
        quizPassed: true,
      });
      expect(result[1]).toMatchObject({
        courseId: 'course-2',
        slideCount: 0,
        slidesViewed: 0,
        allSlidesViewed: false,
      });
    });

    it('caps viewed count at slide count', async () => {
      prisma.assignment.findMany.mockResolvedValue([
        {
          id: 'a1',
          courseId: 'course-1',
          dueDate: null,
          createdAt: new Date(),
          course: {
            id: 'course-1',
            title: 'T',
            description: null,
            _count: { slides: 2, questions: 0 },
          },
        },
      ]);
      prisma.slideProgress.groupBy.mockResolvedValue([
        { courseId: 'course-1', _count: { _all: 9 } },
      ]);

      const result = await service.myTraining('user-1');
      expect(result[0].slidesViewed).toBe(2);
    });
  });
});
