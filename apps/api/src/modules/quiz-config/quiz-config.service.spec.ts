import { Test } from '@nestjs/testing';
import { QuizConfigService } from './quiz-config.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('QuizConfigService', () => {
  let service: QuizConfigService;
  let prisma: {
    course: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    question: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      course: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      question: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [QuizConfigService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(QuizConfigService);
  });

  it('lists course-owned question templates with their set and order', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.question.findMany.mockResolvedValue([
      {
        id: 'q1',
        orderIndex: 0,
        setIndex: 1,
        type: 'multiple_choice',
        text: 'A?',
        imagePath: null,
        options: [{ text: 'x' }, { text: 'y' }],
      },
    ]);

    const rows = await service.getAttached('c1', 1);
    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { courseId: 'c1', setIndex: 1 } }),
    );
    expect(rows).toEqual([
      {
        questionId: 'q1',
        orderIndex: 0,
        setIndex: 1,
        type: 'multiple_choice',
        text: 'A?',
        imagePath: null,
        optionTexts: ['x', 'y'],
      },
    ]);
  });

  it('getConfig reports validity against the 10+ minimum per set', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.course.findUniqueOrThrow.mockResolvedValue({
      passingScore: 80,
      allowRetake: true,
      maxAttempts: null,
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    prisma.question.findMany.mockResolvedValue(
      Array.from({ length: 9 }, () => ({ setIndex: 1 })),
    );

    const invalid = await service.getConfig('c1');
    expect(invalid.questionCount).toBe(9);
    expect(invalid.isValid).toBe(false);

    prisma.question.findMany.mockResolvedValue(
      Array.from({ length: 10 }, () => ({ setIndex: 1 })),
    );
    const valid = await service.getConfig('c1');
    expect(valid.isValid).toBe(true);
    expect(valid.sets).toEqual([{ setIndex: 1, count: 10 }]);
  });

  it('getConfig is valid when any single set has 10 or more questions', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.course.findUniqueOrThrow.mockResolvedValue({
      passingScore: 80,
      allowRetake: true,
      maxAttempts: null,
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    prisma.question.findMany.mockResolvedValue([
      ...Array.from({ length: 12 }, () => ({ setIndex: 1 })),
      ...Array.from({ length: 3 }, () => ({ setIndex: 2 })),
      ...Array.from({ length: 21 }, () => ({ setIndex: 3 })),
    ]);

    const config = await service.getConfig('c1');
    expect(config.isValid).toBe(true);
    expect(config.sets).toEqual([
      { setIndex: 1, count: 12 },
      { setIndex: 2, count: 3 },
      { setIndex: 3, count: 21 },
    ]);
  });

  it('getConfig stays invalid when every set has fewer than 10 questions', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.course.findUniqueOrThrow.mockResolvedValue({
      passingScore: 80,
      allowRetake: true,
      maxAttempts: null,
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    prisma.question.findMany.mockResolvedValue([
      ...Array.from({ length: 9 }, () => ({ setIndex: 1 })),
      ...Array.from({ length: 3 }, () => ({ setIndex: 2 })),
    ]);

    const config = await service.getConfig('c1');
    expect(config.isValid).toBe(false);
    expect(config.sets).toEqual([
      { setIndex: 1, count: 9 },
      { setIndex: 2, count: 3 },
    ]);
  });
});
