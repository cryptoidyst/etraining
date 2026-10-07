import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { QuestionsService } from './questions.service';
import { QuestionImageStorageService } from './question-image-storage.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('QuestionsService', () => {
  let service: QuestionsService;
  let prisma: {
    course: { findUnique: jest.Mock };
    question: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      aggregate: jest.Mock;
    };
    courseQuestion: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'q1',
    courseId: 'c1',
    setIndex: 1,
    orderIndex: 0,
    type: 'multiple_choice',
    text: 'What is 2+2?',
    imagePath: null,
    imageMime: null,
    createdAt: new Date(),
    options: [
      { id: 'o1', text: '3', isCorrect: false, orderIndex: 0 },
      { id: 'o2', text: '4', isCorrect: true, orderIndex: 1 },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      course: { findUnique: jest.fn().mockResolvedValue({ id: 'c1' }) },
      question: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { orderIndex: null } }),
      },
      courseQuestion: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        QuestionsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();
    service = moduleRef.get(QuestionsService);
  });

  it('creates a multiple-choice question with exactly one correct option', async () => {
    prisma.question.create.mockResolvedValue(row());

    await service.create(
      'c1',
      {
        type: 'multiple_choice',
        text: 'What is 2+2?',
        options: [
          { text: '3', isCorrect: false },
          { text: '4', isCorrect: true },
        ],
      },
      'admin-1',
    );

    expect(prisma.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          courseId: 'c1',
          setIndex: 1,
          type: 'multiple_choice',
          createdById: 'admin-1',
          options: {
            create: [
              { text: '3', isCorrect: false, orderIndex: 0 },
              { text: '4', isCorrect: true, orderIndex: 1 },
            ],
          },
        }),
      }),
    );
  });

  it('rejects multiple-choice with zero or multiple correct options', async () => {
    await expect(
      service.create(
        'c1',
        {
          type: 'multiple_choice',
          text: 'Bad question',
          options: [
            { text: 'A', isCorrect: false },
            { text: 'B', isCorrect: false },
          ],
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create(
        'c1',
        {
          type: 'multiple_choice',
          text: 'Bad question',
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: true },
          ],
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes true/false questions to fixed True/False options', async () => {
    prisma.question.create.mockResolvedValue(
      row({
        type: 'true_false',
        options: [
          { id: 'o1', text: 'True', isCorrect: true, orderIndex: 0 },
          { id: 'o2', text: 'False', isCorrect: false, orderIndex: 1 },
        ],
      }),
    );

    await service.create(
      'c1',
      {
        type: 'true_false',
        text: 'The sky is blue.',
        options: [{ text: 'false', isCorrect: true }],
      },
      'admin-1',
    );

    const call = prisma.question.create.mock.calls[0][0];
    expect(call.data.options.create).toEqual([
      { text: 'True', isCorrect: false, orderIndex: 0 },
      { text: 'False', isCorrect: true, orderIndex: 1 },
    ]);
  });

  it('throws NotFound for a missing question on update', async () => {
    prisma.question.findFirst.mockResolvedValue(null);
    await expect(service.update('c1', 'nope', { text: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('replaces options on update with validation', async () => {
    prisma.question.findFirst.mockResolvedValue({
      id: 'q1',
      type: 'multiple_choice',
      setIndex: 1,
    });
    prisma.question.update.mockResolvedValue(row());

    await service.update('c1', 'q1', {
      options: [
        { text: 'A', isCorrect: false },
        { text: 'B', isCorrect: true },
      ],
    });

    expect(prisma.question.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          options: {
            deleteMany: {},
            create: [
              { text: 'A', isCorrect: false, orderIndex: 0 },
              { text: 'B', isCorrect: true, orderIndex: 1 },
            ],
          },
        }),
      }),
    );
  });

  it('keeps course_questions in sync after creating a question', async () => {
    prisma.question.create.mockResolvedValue(row());
    prisma.question.findMany.mockResolvedValue([{ id: 'q1', setIndex: 1, orderIndex: 0 }]);

    await service.create(
      'c1',
      {
        type: 'multiple_choice',
        text: 'What is 2+2?',
        options: [
          { text: '3', isCorrect: false },
          { text: '4', isCorrect: true },
        ],
      },
      'admin-1',
    );

    expect(prisma.courseQuestion.deleteMany).toHaveBeenCalledWith({ where: { courseId: 'c1' } });
    expect(prisma.courseQuestion.createMany).toHaveBeenCalledWith({
      data: [{ courseId: 'c1', questionId: 'q1', setIndex: 1, orderIndex: 0 }],
    });
  });
});

describe('QuestionImageStorageService', () => {
  let storage: QuestionImageStorageService;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qimg-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        QuestionImageStorageService,
        { provide: ConfigService, useValue: { get: jest.fn(() => tmpDir) } },
      ],
    }).compile();
    storage = moduleRef.get(QuestionImageStorageService);
  });

  it('validates mime type and size', () => {
    expect(() => storage.assertValid('application/pdf', 100)).toThrow(BadRequestException);
    expect(() => storage.assertValid('image/png', 6 * 1024 * 1024)).toThrow(BadRequestException);
    expect(storage.isAllowed('image/png')).toBe(true);
  });

  it('rejects magic-byte mismatches', () => {
    expect(() => storage.verifyMagicBytes('image/png', Buffer.from('<html>'))).toThrow(
      BadRequestException,
    );
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(() => storage.verifyMagicBytes('image/png', png)).not.toThrow();
  });

  it('neutralizes path traversal', () => {
    const resolved = storage.resolve('../../etc/passwd');
    expect(resolved.startsWith(path.resolve(tmpDir, '..', 'question-images'))).toBe(true);
  });
});
