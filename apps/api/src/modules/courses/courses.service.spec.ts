import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let prisma: {
    course: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'course-1',
    title: 'Safety Basics',
    description: null,
    status: 'draft',
    passingScore: 80,
    allowRetake: true,
    maxAttempts: null,
    publishedAt: null,
    createdAt: new Date(),
    _count: { slides: 0 },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      course: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [CoursesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CoursesService);
  });

  it('creates a draft course with defaults and creator', async () => {
    prisma.course.create.mockResolvedValue(row());

    await service.create({ title: 'Safety Basics' }, 'admin-1');

    expect(prisma.course.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Safety Basics',
          passingScore: 80,
          allowRetake: true,
          createdById: 'admin-1',
        }),
      }),
    );
  });

  it('blocks publishing a course with no slides', async () => {
    prisma.course.findUnique.mockResolvedValue(row({ _count: { slides: 0 } }));
    await expect(service.publish('course-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('publishes a course that has slides and stamps publishedAt', async () => {
    prisma.course.findUnique.mockResolvedValue(row({ _count: { slides: 3 } }));
    prisma.course.update.mockResolvedValue(row({ status: 'published', publishedAt: new Date() }));

    const result = await service.publish('course-1');

    expect(result.status).toBe('published');
    expect(prisma.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'published' }),
      }),
    );
  });

  it('blocks deleting a published course', async () => {
    prisma.course.findUnique.mockResolvedValue(row({ status: 'published' }));
    await expect(service.remove('course-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes a draft course', async () => {
    prisma.course.findUnique.mockResolvedValue(row({ status: 'draft' }));
    await service.remove('course-1');
    expect(prisma.course.delete).toHaveBeenCalledWith({ where: { id: 'course-1' } });
  });

  it('throws NotFound when updating a missing course', async () => {
    prisma.course.findUnique.mockResolvedValue(null);
    await expect(service.update('nope', { title: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unpublish returns the course to draft and clears publishedAt', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
    prisma.course.update.mockResolvedValue(row({ status: 'draft' }));

    const result = await service.unpublish('course-1');

    expect(result.status).toBe('draft');
    expect(prisma.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'draft', publishedAt: null }),
      }),
    );
  });
});
