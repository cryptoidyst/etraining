import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ProgressService', () => {
  let service: ProgressService;
  let prisma: {
    slide: { findFirst: jest.Mock; count: jest.Mock };
    slideProgress: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    course: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      slide: {
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      slideProgress: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      course: { findUnique: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ProgressService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ProgressService);
  });

  it('rejects a view for a slide that is not in the course', async () => {
    prisma.slide.findFirst.mockResolvedValue(null);
    await expect(service.recordSlideView('u1', 'c1', 's1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records a view idempotently via upsert', async () => {
    prisma.slide.findFirst.mockResolvedValue({ id: 's1' });
    prisma.slideProgress.upsert.mockResolvedValue({ slideId: 's1', viewedAt: new Date() });

    const result = await service.recordSlideView('u1', 'c1', 's1');

    expect(result.slideId).toBe('s1');
    expect(prisma.slideProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_slideId: { userId: 'u1', slideId: 's1' } },
        update: {},
      }),
    );
  });

  it('computes progress and locks the quiz until all slides are viewed', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.slide.count.mockResolvedValue(4);
    prisma.slideProgress.findMany.mockResolvedValue([
      { slideId: 'a', viewedAt: new Date() },
      { slideId: 'b', viewedAt: new Date() },
    ]);

    const progress = await service.getCourseProgress('u1', 'c1');

    expect(progress.totalSlides).toBe(4);
    expect(progress.viewedSlides).toBe(2);
    expect(progress.percent).toBe(50);
    expect(progress.allSlidesViewed).toBe(false);

    prisma.slideProgress.count.mockResolvedValue(2);
    await expect(service.isQuizUnlocked('u1', 'c1')).resolves.toBe(false);

    prisma.slideProgress.count.mockResolvedValue(4);
    prisma.slideProgress.findMany.mockResolvedValue(
      Array.from({ length: 4 }, () => ({ slideId: 'x', viewedAt: new Date() })),
    );
    const complete = await service.getCourseProgress('u1', 'c1');
    expect(complete.allSlidesViewed).toBe(true);
    await expect(service.isQuizUnlocked('u1', 'c1')).resolves.toBe(true);
  });

  it('never unlocks a course with zero slides', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.slide.count.mockResolvedValue(0);
    prisma.slideProgress.count.mockResolvedValue(0);
    await expect(service.isQuizUnlocked('u1', 'c1')).resolves.toBe(false);
  });

  it('throws NotFound for an unknown course', async () => {
    prisma.course.findUnique.mockResolvedValue(null);
    await expect(service.getCourseProgress('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
