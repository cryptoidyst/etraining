import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('QuizAttemptsService', () => {
  let service: QuizAttemptsService;
  let prisma: Record<string, any>;

  const course = (overrides: Record<string, unknown> = {}) => ({
    id: 'course-1',
    status: 'published',
    allowRetake: true,
    maxAttempts: null,
    passingScore: 80,
    shuffleQuestions: true,
    shuffleOptions: true,
    ...overrides,
  });

  const attached = [
    {
      questionId: 'q1',
      setIndex: 1,
      question: {
        id: 'q1',
        type: 'multiple_choice',
        text: 'Q1',
        imagePath: null,
        options: [
          { id: 'o1', text: 'A', isCorrect: true },
          { id: 'o2', text: 'B', isCorrect: false },
        ],
      },
    },
    {
      questionId: 'q2',
      setIndex: 1,
      question: {
        id: 'q2',
        type: 'true_false',
        text: 'Q2',
        imagePath: null,
        options: [
          { id: 'o3', text: 'True', isCorrect: true },
          { id: 'o4', text: 'False', isCorrect: false },
        ],
      },
    },
  ];

  const attachedSet = Array.from({ length: 10 }, (_, i) => ({
    questionId: `q${i}`,
    setIndex: 1,
    question: {
      id: `q${i}`,
      type: 'multiple_choice',
      text: `Q${i}`,
      imagePath: null,
      options: [
        { id: `o${i}a`, text: 'A', isCorrect: true },
        { id: `o${i}b`, text: 'B', isCorrect: false },
      ],
    },
  }));

  beforeEach(async () => {
    prisma = {
      course: {
        findUnique: jest.fn().mockResolvedValue(course()),
        findUniqueOrThrow: jest.fn().mockResolvedValue(course()),
      },
      assignment: { count: jest.fn().mockResolvedValue(1) },
      slide: { count: jest.fn().mockResolvedValue(3) },
      slideProgress: { count: jest.fn().mockResolvedValue(3) },
      courseQuestion: {
        count: jest.fn().mockResolvedValue(10),
        findMany: jest.fn().mockResolvedValue(attachedSet),
      },
      quizAttempt: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      quizAnswer: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest
        .fn()
        .mockImplementation(async (ops: unknown) => Promise.all(ops as Promise<unknown>[])),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [QuizAttemptsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(QuizAttemptsService);
  });

  describe('eligibility', () => {
    it('throws NotFound for a missing course', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.getEligibility('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reports assigned, viewed, and not ready when quiz too small', async () => {
      prisma.courseQuestion.findMany.mockResolvedValue(
        Array.from({ length: 5 }, () => ({ setIndex: 1 })),
      );
      prisma.assignment.count.mockResolvedValue(1);
      prisma.quizAttempt.findMany.mockResolvedValue([]);

      const result = await service.getEligibility('u1', 'course-1');

      expect(result).toMatchObject({
        assigned: true,
        allSlidesViewed: true,
        questionCount: 5,
        quizReady: false,
        passed: null,
      });
    });
  });

  describe('start', () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );
    });

    it('rejects when not assigned', async () => {
      prisma.assignment.count.mockResolvedValue(0);
      await expect(service.start('u1', 'course-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when slides are not fully viewed', async () => {
      prisma.slideProgress.count.mockResolvedValue(2);
      await expect(service.start('u1', 'course-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when quiz has fewer than 10 questions', async () => {
      prisma.courseQuestion.findMany.mockResolvedValue(
        Array.from({ length: 9 }, () => ({ setIndex: 1 })),
      );
      await expect(service.start('u1', 'course-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('conflicts when already passed', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue({
        id: 'a9',
        scorePercent: 100,
        passed: true,
      });
      await expect(service.start('u1', 'course-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('resumes the in-progress attempt instead of creating one', async () => {
      prisma.quizAttempt.findMany.mockResolvedValue([
        { id: 'a-live', status: 'in_progress', scorePercent: null, passed: null },
      ]);
      prisma.quizAttempt.findUnique.mockResolvedValue({
        id: 'a-live',
        userId: 'u1',
        courseId: 'course-1',
        attemptNumber: 1,
        status: 'in_progress',
        setIndex: 1,
        questionOrder: ['q1', 'q2'],
        optionOrder: { q1: ['o1', 'o2'], q2: ['o3', 'o4'] },
        course: {
          questions: attached,
        },
      });

      const result = await service.start('u1', 'course-1');

      expect(result.attemptId).toBe('a-live');
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('blocks retake when allowRetake is false', async () => {
      prisma.course.findUniqueOrThrow.mockResolvedValue(course({ allowRetake: false }));
      prisma.quizAttempt.findMany.mockResolvedValue([
        { id: 'a1', status: 'submitted', scorePercent: 50, passed: false },
      ]);
      await expect(service.start('u1', 'course-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks when max attempts reached', async () => {
      prisma.course.findUniqueOrThrow.mockResolvedValue(course({ maxAttempts: 2 }));
      prisma.quizAttempt.findMany.mockResolvedValue([
        { id: 'a1', status: 'submitted', scorePercent: 50, passed: false },
        { id: 'a2', status: 'submitted', scorePercent: 60, passed: false },
      ]);
      await expect(service.start('u1', 'course-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a new attempt with sanitized questions (no correct flags)', async () => {
      prisma.quizAttempt.create.mockResolvedValue({
        id: 'a-new',
        courseId: 'course-1',
        attemptNumber: 1,
        status: 'in_progress',
      });

      const result = await service.start('u1', 'course-1');

      expect(result.attemptId).toBe('a-new');
      expect(result.questions).toHaveLength(10);
      expect(JSON.stringify(result.questions)).not.toContain('isCorrect');
    });

    it('shuffles question and option order while keeping every question', async () => {
      prisma.quizAttempt.create.mockResolvedValue({
        id: 'a-new',
        courseId: 'course-1',
        attemptNumber: 1,
        status: 'in_progress',
      });

      const result = await service.start('u1', 'course-1');

      const returnedIds = result.questions.map((q: { questionId: string }) => q.questionId);
      expect(new Set(returnedIds).size).toBe(10);
      // Each option list is a permutation of the original two options.
      for (const q of result.questions) {
        expect(q.options).toHaveLength(2);
      }
    });
  });

  describe('submit', () => {
    const attemptRow = {
      id: 'a1',
      userId: 'u1',
      status: 'in_progress',
      courseId: 'course-1',
      attemptNumber: 1,
      setIndex: null,
    };

    beforeEach(() => {
      prisma.quizAttempt.findUnique.mockResolvedValue(attemptRow);
      prisma.quizAttempt.update.mockResolvedValue({
        ...attemptRow,
        status: 'submitted',
      });
      prisma.quizAttempt.count.mockResolvedValue(1);
      // Two-question set with option text for the review payload.
      prisma.courseQuestion.findMany.mockResolvedValue(
        attached.map((row) => ({
          questionId: row.questionId,
          question: {
            text: row.question.text,
            options: row.question.options.map((o) => ({
              id: o.id,
              text: o.text,
              isCorrect: o.isCorrect,
            })),
          },
        })),
      );
    });

    it('scores 100 when all answers correct and passes at 80', async () => {
      const result = await service.submit('u1', 'a1', [
        { questionId: 'q1', selectedOptionIds: ['o1'] },
        { questionId: 'q2', selectedOptionIds: ['o3'] },
      ]);

      expect(result).toMatchObject({
        scorePercent: 100,
        correctAnswers: 2,
        totalQuestions: 2,
        passed: true,
        canRetry: false,
      });
    });

    it('fails below the passing score and offers retry per policy', async () => {
      prisma.course.findUniqueOrThrow.mockResolvedValue(course({ passingScore: 80 }));

      const result = await service.submit('u1', 'a1', [
        { questionId: 'q1', selectedOptionIds: ['o2'] },
        { questionId: 'q2', selectedOptionIds: ['o3'] },
      ]);

      expect(result).toMatchObject({
        scorePercent: 50,
        passed: false,
        canRetry: true,
        attemptsUsed: 2,
        attemptsLeft: null,
      });
    });

    it('blocks retry when allowRetake is false', async () => {
      prisma.course.findUniqueOrThrow.mockResolvedValue(course({ allowRetake: false }));

      const result = await service.submit('u1', 'a1', [
        { questionId: 'q1', selectedOptionIds: ['o2'] },
        { questionId: 'q2', selectedOptionIds: ['o4'] },
      ]);

      expect(result.canRetry).toBe(false);
    });

    it('rejects a second submit for a submitted attempt', async () => {
      prisma.quizAttempt.findUnique.mockResolvedValue({
        ...attemptRow,
        status: 'submitted',
      });
      await expect(
        service.submit('u1', 'a1', [
          { questionId: 'q1', selectedOptionIds: ['o1'] },
          { questionId: 'q2', selectedOptionIds: ['o3'] },
        ]),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects another user’s attempt', async () => {
      prisma.quizAttempt.findUnique.mockResolvedValue({
        ...attemptRow,
        userId: 'someone-else',
      });
      await expect(
        service.submit('u1', 'a1', [
          { questionId: 'q1', selectedOptionIds: ['o1'] },
          { questionId: 'q2', selectedOptionIds: ['o3'] },
        ]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects duplicate answers and foreign questions/options', async () => {
      await expect(
        service.submit('u1', 'a1', [
          { questionId: 'q1', selectedOptionIds: ['o1'] },
          { questionId: 'q1', selectedOptionIds: ['o1'] },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.submit('u1', 'a1', [
          { questionId: 'qX', selectedOptionIds: ['o1'] },
          { questionId: 'q2', selectedOptionIds: ['o3'] },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.submit('u1', 'a1', [
          { questionId: 'q1', selectedOptionIds: ['oX'] },
          { questionId: 'q2', selectedOptionIds: ['o3'] },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when questions are unanswered', async () => {
      await expect(
        service.submit('u1', 'a1', [{ questionId: 'q1', selectedOptionIds: ['o1'] }]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks correct only when the exact correct option set is chosen', async () => {
      const result = await service.submit('u1', 'a1', [
        { questionId: 'q1', selectedOptionIds: ['o1', 'o2'] },
        { questionId: 'q2', selectedOptionIds: ['o3'] },
      ]);

      const q1 = result.results.find((r) => r.questionId === 'q1');
      expect(q1?.isCorrect).toBe(false);
      expect(result.scorePercent).toBe(50);
    });
  });

  describe('completion', () => {
    it('reflects the best submitted attempt', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue({
        id: 'a-best',
        scorePercent: 90,
        passed: true,
        submittedAt: new Date('2026-09-23'),
      });
      prisma.quizAttempt.count.mockResolvedValue(2);

      const result = await service.getCompletion('u1', 'course-1');

      expect(result).toMatchObject({
        completed: true,
        bestScore: 90,
        bestAttemptId: 'a-best',
        attemptsUsed: 2,
        slideCount: 3,
        slidesViewed: 3,
      });
    });

    it('is not complete without a passed attempt', async () => {
      prisma.quizAttempt.findFirst.mockResolvedValue(null);
      prisma.quizAttempt.count.mockResolvedValue(1);
      prisma.slideProgress.count.mockResolvedValue(2);

      const result = await service.getCompletion('u1', 'course-1');

      expect(result).toMatchObject({
        completed: false,
        bestScore: null,
        slidesViewed: 2,
      });
    });
  });
});
