import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateQuestionDto,
  QuestionDto,
  QuestionQueryDto,
  UpdateQuestionDto,
} from './dto/question.dto';
import type { BulkCreateQuestionsResultDto } from './dto/question.dto';

const questionInclude = {
  options: { orderBy: { orderIndex: 'asc' } },
} satisfies Prisma.QuestionInclude;

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    courseId: string,
    query: QuestionQueryDto,
  ): Promise<{ items: QuestionDto[]; total: number }> {
    await this.assertCourseExists(courseId);
    const where: Prisma.QuestionWhereInput = {
      courseId,
      AND: [
        query.type ? { type: query.type } : {},
        query.setIndex !== undefined ? { setIndex: query.setIndex } : {},
        query.search ? { text: { contains: query.search, mode: 'insensitive' } } : {},
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        include: questionInclude,
        orderBy: [{ setIndex: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }],
        take: Math.min(query.limit ?? 50, 200),
        skip: query.offset ?? 0,
      }),
      this.prisma.question.count({ where }),
    ]);
    return { items: items.map(toDto), total };
  }

  async getById(courseId: string, id: string): Promise<QuestionDto> {
    const question = await this.prisma.question.findFirst({
      where: { id, courseId },
      include: questionInclude,
    });
    if (!question) throw new NotFoundException('Question not found in this course.');
    return toDto(question);
  }

  async create(courseId: string, dto: CreateQuestionDto, userId: string): Promise<QuestionDto> {
    await this.assertCourseExists(courseId);
    const options = this.normalizeOptions(dto.type, dto.options);
    const setIndex = dto.setIndex ?? 1;
    const question = await this.prisma.question.create({
      data: {
        courseId,
        setIndex,
        orderIndex: await this.nextOrderIndex(courseId, setIndex),
        type: dto.type,
        text: dto.text.trim(),
        createdById: userId,
        options: { create: options },
      },
      include: questionInclude,
    });
    await this.syncCourseQuestions(courseId);
    return toDto(question);
  }

  async createBulk(
    courseId: string,
    rawText: string,
    userId: string,
    setIndex = 1,
  ): Promise<BulkCreateQuestionsResultDto> {
    await this.assertCourseExists(courseId);
    const { questions, errors } = parseBulkQuestions(rawText);

    if (questions.length === 0) {
      return {
        created: 0,
        failed: errors.length,
        errors:
          errors.length > 0
            ? errors
            : ['No questions found. Use the format: "1. Question? / A. option / Answer: A".'],
      };
    }

    let created = 0;
    const allErrors = [...errors];
    let orderIndex = await this.nextOrderIndex(courseId, setIndex);

    for (const [index, parsed] of questions.entries()) {
      try {
        const options = this.normalizeOptions(parsed.type, parsed.options);
        await this.prisma.question.create({
          data: {
            courseId,
            setIndex,
            orderIndex: orderIndex++,
            type: parsed.type,
            text: parsed.text,
            createdById: userId,
            options: { create: options },
          },
        });
        created += 1;
      } catch (error) {
        const label = parsed.text.slice(0, 40) || `item ${index + 1}`;
        allErrors.push(`"${label}…": ${(error as Error).message}`);
      }
    }

    if (created > 0) await this.syncCourseQuestions(courseId);
    return { created, failed: allErrors.length, errors: allErrors };
  }

  async update(courseId: string, id: string, dto: UpdateQuestionDto): Promise<QuestionDto> {
    const existing = await this.prisma.question.findFirst({
      where: { id, courseId },
      select: { id: true, type: true, setIndex: true },
    });
    if (!existing) throw new NotFoundException('Question not found in this course.');

    const options =
      dto.options === undefined
        ? undefined
        : { deleteMany: {}, create: this.normalizeOptions(existing.type, dto.options) };

    const moving = dto.setIndex !== undefined && dto.setIndex !== existing.setIndex;
    const question = await this.prisma.question.update({
      where: { id: existing.id },
      data: {
        text: dto.text,
        options,
        ...(moving
          ? { setIndex: dto.setIndex, orderIndex: await this.nextOrderIndex(courseId, dto.setIndex!) }
          : {}),
      },
      include: questionInclude,
    });
    await this.syncCourseQuestions(courseId);
    return toDto(question);
  }

  async remove(courseId: string, id: string): Promise<void> {
    const exists = await this.prisma.question.findFirst({
      where: { id, courseId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Question not found in this course.');
    await this.prisma.question.delete({ where: { id: exists.id } });
    await this.syncCourseQuestions(courseId);
  }

  /**
   * Replaces the full ordering within a set. Must include every question of
   * that set exactly once.
   */
  async reorder(
    courseId: string,
    setIndex: number,
    questionIds: string[],
  ): Promise<QuestionDto[]> {
    await this.assertCourseExists(courseId);
    const inSet = await this.prisma.question.findMany({
      where: { courseId, setIndex },
      select: { id: true },
    });
    const inSetIds = new Set(inSet.map((q) => q.id));
    const unique = new Set(questionIds);

    if (unique.size !== questionIds.length) {
      throw new BadRequestException('Duplicate question ids in reorder payload.');
    }
    if (questionIds.some((qid) => !inSetIds.has(qid))) {
      throw new BadRequestException('Reorder payload references questions outside this set.');
    }
    if (questionIds.length !== inSet.length) {
      throw new BadRequestException('Reorder payload must include every question of the set.');
    }

    await this.prisma.$transaction(
      questionIds.map((qid, index) =>
        this.prisma.question.update({ where: { id: qid }, data: { orderIndex: index } }),
      ),
    );
    await this.syncCourseQuestions(courseId);

    const { items } = await this.list(courseId, { setIndex, limit: 200 });
    return items;
  }

  async setImage(
    courseId: string,
    id: string,
    image: { storedPath: string; mimeType: string },
  ): Promise<QuestionDto> {
    await this.assertInCourse(courseId, id);
    const question = await this.prisma.question.update({
      where: { id },
      data: { imagePath: image.storedPath, imageMime: image.mimeType },
      include: questionInclude,
    });
    return toDto(question);
  }

  async removeImage(courseId: string, id: string): Promise<QuestionDto> {
    const question = await this.prisma.question.findFirst({
      where: { id, courseId },
      select: { id: true },
    });
    if (!question) throw new NotFoundException('Question not found in this course.');
    await this.prisma.question.update({
      where: { id: question.id },
      data: { imagePath: null, imageMime: null },
    });
    return this.getById(courseId, question.id);
  }

  /** Next free orderIndex at the end of a set. */
  private async nextOrderIndex(courseId: string, setIndex: number): Promise<number> {
    const last = await this.prisma.question.aggregate({
      where: { courseId, setIndex },
      _max: { orderIndex: true },
    });
    return (last._max.orderIndex ?? -1) + 1;
  }

  /**
   * Keeps the legacy course_questions join table in sync with the
   * course-owned questions so quiz attempts keep working unchanged.
   */
  private async syncCourseQuestions(courseId: string): Promise<void> {
    const questions = await this.prisma.question.findMany({
      where: { courseId },
      select: { id: true, setIndex: true, orderIndex: true },
    });
    await this.prisma.$transaction([
      this.prisma.courseQuestion.deleteMany({ where: { courseId } }),
      ...(questions.length > 0
        ? [
            this.prisma.courseQuestion.createMany({
              data: questions.map((q) => ({
                courseId,
                questionId: q.id,
                setIndex: q.setIndex,
                orderIndex: q.orderIndex,
              })),
            }),
          ]
        : []),
    ]);
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const exists = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Course not found.');
  }

  private async assertInCourse(courseId: string, id: string): Promise<void> {
    const exists = await this.prisma.question.findFirst({
      where: { id, courseId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Question not found in this course.');
  }

  /**
   * Enforces correct-answer rules per question type:
   * multiple_choice: exactly one correct; true_false: exactly True + False,
   * correct flag taken from the option labelled "true".
   */
  private normalizeOptions(
    type: string,
    options: { text: string; isCorrect: boolean }[],
  ): { text: string; isCorrect: boolean; orderIndex: number }[] {
    if (type === 'true_false') {
      const markedTrue = options.find((o) => o.text.trim().toLowerCase() === 'true');
      const markedFalse = options.find((o) => o.text.trim().toLowerCase() === 'false');
      const correctIsTrue = markedTrue ? markedTrue.isCorrect : !(markedFalse?.isCorrect ?? true);
      return [
        { text: 'True', isCorrect: correctIsTrue, orderIndex: 0 },
        { text: 'False', isCorrect: !correctIsTrue, orderIndex: 1 },
      ];
    }

    const correctCount = options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      throw new BadRequestException(
        'Multiple choice questions must have exactly one correct option.',
      );
    }
    return options.map((o, index) => ({
      text: o.text.trim(),
      isCorrect: o.isCorrect,
      orderIndex: index,
    }));
  }
}

interface QuestionRow {
  id: string;
  courseId: string;
  setIndex: number;
  orderIndex: number;
  type: string;
  text: string;
  imagePath: string | null;
  imageMime?: string | null;
  createdAt: Date;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
    orderIndex: number;
  }[];
}
function toDto(question: QuestionRow): QuestionDto {
  return {
    id: question.id,
    courseId: question.courseId,
    setIndex: question.setIndex,
    orderIndex: question.orderIndex,
    type: question.type,
    text: question.text,
    imagePath: question.imagePath,
    imageMime: question.imageMime ?? null,
    createdAt: question.createdAt,
    options: [...question.options].sort((a, b) => a.orderIndex - b.orderIndex),
  };
}

interface ParsedBulkQuestion {
  type: 'multiple_choice' | 'true_false';
  text: string;
  options: { text: string; isCorrect: boolean }[];
}

const BULK_QUESTION_RE = /^\s*\d+[.)]\s*(.+)$/;
const BULK_OPTION_RE = /^\s*([A-Za-z])[.)]\s*(.+)$/;
const BULK_ANSWER_RE = /^\s*answer\s*[: -]?\s*([A-Za-z])\b/i;

/**
 * Parses the bulk-import format:
 *
 *   1. What is the capital of France?
 *   A. London
 *   B. Paris
 *   C. Berlin
 *   D. Madrid
 *   Answer: B
 *
 * Questions are separated by blank lines (or simply by the next numbered line).
 * For a two-option question whose options are True/False, a true_false question
 * is created automatically.
 */
function parseBulkQuestions(raw: string): {
  questions: ParsedBulkQuestion[];
  errors: string[];
} {
  const errors: string[] = [];
  const questions: ParsedBulkQuestion[] = [];

  const lines = raw.replace(/\r\n?/g, '\n').split('\n');

  interface Building {
    number: number;
    text: string;
    options: { letter: string; text: string }[];
    answerLetter: string | null;
  }
  let current: Building | null = null;

  const flush = () => {
    if (!current) return;
    const { number, text, options, answerLetter } = current;
    current = null;

    if (options.length < 2) {
      errors.push(`Question ${number}: needs at least two options (A. and B.).`);
      return;
    }
    if (!answerLetter) {
      errors.push(`Question ${number}: missing the correct answer line (e.g. "Answer: A").`);
      return;
    }

    const answerIndex = options.findIndex(
      (o) => o.letter.toUpperCase() === answerLetter.toUpperCase(),
    );
    if (answerIndex === -1) {
      errors.push(`Question ${number}: answer "${answerLetter}" does not match any option.`);
      return;
    }

    const lowerTexts = options.map((o) => o.text.trim().toLowerCase());
    const isTrueFalse =
      options.length === 2 && lowerTexts.includes('true') && lowerTexts.includes('false');

    if (isTrueFalse) {
      const correctIsTrue = options[answerIndex].text.trim().toLowerCase() === 'true';
      questions.push({
        type: 'true_false',
        text,
        options: [
          { text: 'True', isCorrect: correctIsTrue },
          { text: 'False', isCorrect: !correctIsTrue },
        ],
      });
      return;
    }

    questions.push({
      type: 'multiple_choice',
      text,
      options: options.map((o, index) => ({
        text: o.text.trim(),
        isCorrect: index === answerIndex,
      })),
    });
  };

  for (const line of lines) {
    if (line.trim() === '') continue;

    const questionMatch = line.match(BULK_QUESTION_RE);
    if (questionMatch) {
      flush();
      const num = Number.parseInt(line.trim(), 10);
      current = {
        number: Number.isNaN(num) ? questions.length + 1 : num,
        text: questionMatch[1].trim(),
        options: [],
        answerLetter: null,
      };
      continue;
    }

    const answerMatch = line.match(BULK_ANSWER_RE);
    if (answerMatch) {
      if (current) current.answerLetter = answerMatch[1];
      continue;
    }

    const optionMatch = line.match(BULK_OPTION_RE);
    if (optionMatch) {
      if (!current) {
        errors.push(`Option "${line.trim()}" appears before any numbered question.`);
        continue;
      }
      current.options.push({ letter: optionMatch[1], text: optionMatch[2].trim() });
      continue;
    }

    if (!current) {
      errors.push(`Line "${line.trim().slice(0, 40)}" is not in the supported format.`);
    } else {
      current.text = `${current.text} ${line.trim()}`.trim();
    }
  }

  flush();
  return { questions, errors };
}
