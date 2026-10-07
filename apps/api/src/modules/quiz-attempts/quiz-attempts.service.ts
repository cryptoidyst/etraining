import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUIZ_MIN_QUESTIONS } from '../quiz-config/dto/quiz-config.dto';

@Injectable()
export class QuizAttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEligibility(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });
    if (!course) throw new NotFoundException('Course not found.');

    const [assignmentCount, totalSlides, viewedCount, courseQuestions, attempts, best] =
      await this.prisma.$transaction([
        this.prisma.assignment.count({ where: { userId, courseId } }),
        this.prisma.slide.count({ where: { courseId } }),
        this.prisma.slideProgress.count({ where: { userId, courseId } }),
        this.prisma.courseQuestion.findMany({
          where: { courseId },
          select: { setIndex: true },
        }),
        this.prisma.quizAttempt.findMany({
          where: { userId, courseId },
          select: { id: true, status: true, scorePercent: true, passed: true },
        }),
        this.prisma.quizAttempt.findFirst({
          where: { userId, courseId, status: 'submitted' },
          orderBy: [{ scorePercent: 'desc' }, { submittedAt: 'asc' }],
          select: { id: true, scorePercent: true, passed: true },
        }),
      ]);

    const setSizes = new Map<number, number>();
    for (const cq of courseQuestions) {
      setSizes.set(cq.setIndex, (setSizes.get(cq.setIndex) ?? 0) + 1);
    }
    const sets = [...setSizes.entries()]
      .map(([setIndex, count]) => ({ setIndex, count }))
      .sort((a, b) => a.setIndex - b.setIndex);
    const validSets = sets.filter((s) => s.count >= QUIZ_MIN_QUESTIONS);
    const questionCount = courseQuestions.length;

    const allSlidesViewed = totalSlides > 0 && viewedCount >= totalSlides;
    const inProgress = attempts.find((a) => a.status === 'in_progress');
    const passed = best?.passed === true ? true : null;
    const quizConfigured = validSets.length > 0;

    return {
      courseId,
      assigned: assignmentCount > 0,
      allSlidesViewed,
      questionCount,
      minQuestions: QUIZ_MIN_QUESTIONS,
      sets,
      validSetCount: validSets.length,
      quizConfigured,
      quizReady:
        course.status === 'published' &&
        assignmentCount > 0 &&
        allSlidesViewed &&
        quizConfigured &&
        !passed,
      attemptsUsed: attempts.filter((a) => a.status !== 'in_progress').length,
      attemptsLeft: null,
      bestScore: best?.scorePercent ?? null,
      passed,
      resumeAttemptId: inProgress?.id ?? null,
    };
  }

  async start(userId: string, courseId: string) {
    const eligibility = await this.getEligibility(userId, courseId);

    if (!eligibility.assigned) {
      throw new ForbiddenException('You are not assigned to this course.');
    }
    if (!eligibility.allSlidesViewed) {
      throw new ForbiddenException('View all slides before starting the quiz.');
    }
    if (eligibility.questionCount < QUIZ_MIN_QUESTIONS) {
      throw new ConflictException(
        `Quiz must have at least ${QUIZ_MIN_QUESTIONS} questions (currently ${eligibility.questionCount}).`,
      );
    }
    if (eligibility.passed) {
      throw new ConflictException('Course already completed.');
    }
    if (eligibility.resumeAttemptId) {
      return this.getAttempt(userId, eligibility.resumeAttemptId);
    }

    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: {
        status: true,
        allowRetake: true,
        maxAttempts: true,
        shuffleQuestions: true,
        shuffleOptions: true,
      },
    });
    if (course.status !== 'published') {
      throw new ForbiddenException('Course is not published.');
    }
    if (eligibility.attemptsUsed > 0) {
      if (!course.allowRetake) {
        throw new ForbiddenException('Retakes are not allowed for this course.');
      }
      if (course.maxAttempts !== null && eligibility.attemptsUsed >= course.maxAttempts) {
        throw new ConflictException('Attempt limit reached.');
      }
    }

    const validSets = eligibility.sets
      .filter((s) => s.count >= QUIZ_MIN_QUESTIONS)
      .map((s) => s.setIndex);
    if (validSets.length === 0) {
      throw new ConflictException(
        `Quiz must have at least one set of ${QUIZ_MIN_QUESTIONS}+ questions before it can be taken.`,
      );
    }
    const chosenSet = validSets[Math.floor(Math.random() * validSets.length)];

    const courseQuestions = await this.prisma.courseQuestion.findMany({
      where: { courseId, setIndex: chosenSet },
      orderBy: { orderIndex: 'asc' },
      select: {
        question: {
          select: {
            id: true,
            type: true,
            text: true,
            imagePath: true,
            options: { orderBy: { orderIndex: 'asc' }, select: { id: true, text: true } },
          },
        },
      },
    });

    const questionOrder = courseQuestions.map((cq) => cq.question.id);
    if (course.shuffleQuestions) shuffleInPlace(questionOrder);

    const optionOrder: Record<string, string[]> = {};
    for (const cq of courseQuestions) {
      const ids = cq.question.options.map((o) => o.id);
      if (course.shuffleOptions) shuffleInPlace(ids);
      optionOrder[cq.question.id] = ids;
    }

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        courseId,
        attemptNumber: eligibility.attemptsUsed + 1,
        totalQuestions: courseQuestions.length,
        status: 'in_progress',
        setIndex: chosenSet,
        questionOrder,
        optionOrder,
      },
    });

    return this.presentAttempt(attempt, courseQuestions, questionOrder, optionOrder);
  }

  private presentAttempt(
    attempt: { id: string; courseId: string; attemptNumber: number; status: string },
    courseQuestions: {
      question: {
        id: string;
        type: string;
        text: string;
        imagePath: string | null;
        options: { id: string; text: string }[];
      };
    }[],
    questionOrder: string[],
    optionOrder: Record<string, string[]>,
  ) {
    const byId = new Map(courseQuestions.map((cq) => [cq.question.id, cq.question]));
    const questions = questionOrder
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map((q) => {
        const orderedOptionIds = optionOrder[q.id] ?? q.options.map((o) => o.id);
        const optionById = new Map(q.options.map((o) => [o.id, o]));
        return {
          questionId: q.id,
          type: q.type,
          text: q.text,
          imagePath: q.imagePath,
          options: orderedOptionIds
            .map((oid) => optionById.get(oid))
            .filter((o): o is NonNullable<typeof o> => Boolean(o))
            .map((o) => ({ optionId: o.id, text: o.text })),
        };
      });

    return {
      attemptId: attempt.id,
      courseId: attempt.courseId,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      questions,
    };
  }

  async getAttempt(userId: string, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        userId: true,
        courseId: true,
        attemptNumber: true,
        status: true,
        setIndex: true,
        questionOrder: true,
        optionOrder: true,
        course: {
          select: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              select: {
                question: {
                  select: {
                    id: true,
                    type: true,
                    text: true,
                    imagePath: true,
                    options: { orderBy: { orderIndex: 'asc' }, select: { id: true, text: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException('Attempt not found.');
    }

    const questionOrder = Array.isArray(attempt.questionOrder)
      ? (attempt.questionOrder as string[])
      : attempt.course.questions.map((cq) => cq.question.id);
    const optionOrder = (attempt.optionOrder ?? {}) as Record<string, string[]>;

    return this.presentAttempt(
      attempt,
      attempt.course.questions.map((cq) => cq),
      questionOrder,
      optionOrder,
    );
  }

  async submit(
    userId: string,
    attemptId: string,
    answers: {
      questionId: string;
      selectedOptionIds: string[];
    }[],
  ) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        userId: true,
        status: true,
        courseId: true,
        attemptNumber: true,
        setIndex: true,
      },
    });
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException('Attempt not found.');
    }
    if (attempt.status !== 'in_progress') {
      throw new ConflictException('Attempt already submitted.');
    }

    const attachedQuestions = await this.prisma.courseQuestion.findMany({
      where: {
        courseId: attempt.courseId,
        ...(attempt.setIndex !== null ? { setIndex: attempt.setIndex } : {}),
      },
      select: {
        questionId: true,
        question: {
          select: {
            text: true,
            options: { select: { id: true, text: true, isCorrect: true } },
          },
        },
      },
    });
    const questionMap = new Map(attachedQuestions.map((cq) => [cq.questionId, cq.question]));

    const seen = new Set<string>();
    let correctCount = 0;
    const results: {
      questionId: string;
      isCorrect: boolean;
      questionText: string;
      correctOptionTexts: string[];
      selectedOptionTexts: string[];
    }[] = [];
    const answerRows: {
      questionId: string;
      isCorrect: boolean;
      selectedOptionIds: string[];
    }[] = [];

    for (const answer of answers) {
      if (seen.has(answer.questionId)) {
        throw new BadRequestException('Duplicate answers for a question.');
      }
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new BadRequestException('Answer references a question not in this quiz.');
      }
      const options = question.options;
      const optionIds = new Set(options.map((o) => o.id));
      if (answer.selectedOptionIds.some((id) => !optionIds.has(id))) {
        throw new BadRequestException('Answer references an option outside the question.');
      }
      seen.add(answer.questionId);

      const correctOptionIds = new Set(options.filter((o) => o.isCorrect).map((o) => o.id));
      const isCorrect =
        answer.selectedOptionIds.length === correctOptionIds.size &&
        answer.selectedOptionIds.every((id) => correctOptionIds.has(id));

      if (isCorrect) correctCount += 1;
      results.push({
        questionId: answer.questionId,
        isCorrect,
        questionText: question.text,
        correctOptionTexts: options.filter((o) => o.isCorrect).map((o) => o.text),
        selectedOptionTexts: options
          .filter((o) => answer.selectedOptionIds.includes(o.id))
          .map((o) => o.text),
      });
      answerRows.push({
        questionId: answer.questionId,
        isCorrect,
        selectedOptionIds: answer.selectedOptionIds,
      });
    }

    const unanswered = attachedQuestions.length - seen.size;
    if (unanswered > 0) {
      throw new BadRequestException(`Unanswered questions: ${unanswered}.`);
    }

    const total = attachedQuestions.length;
    const scorePercent = total === 0 ? 0 : Math.round((correctCount / total) * 100);
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: attempt.courseId },
      select: { passingScore: true, allowRetake: true, maxAttempts: true },
    });
    const passed = scorePercent >= course.passingScore;

    const attemptsUsed = await this.prisma.quizAttempt.count({
      where: { userId, courseId: attempt.courseId, status: { not: 'in_progress' } },
    });

    const [updatedAttempt] = await this.prisma.$transaction([
      this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'submitted',
          submittedAt: new Date(),
          scorePercent,
          correctAnswers: correctCount,
          totalQuestions: total,
          passed,
        },
      }),
      ...answerRows.map((row) =>
        this.prisma.quizAnswer.create({
          data: {
            attemptId,
            questionId: row.questionId,
            isCorrect: row.isCorrect,
            selectedOption: {
              create: row.selectedOptionIds.map((optionId) => ({ selectedOptionId: optionId })),
            },
          },
        }),
      ),
    ]);

    const usedAfter = attemptsUsed + 1;
    const canRetry =
      !passed &&
      course.allowRetake &&
      (course.maxAttempts === null || usedAfter < course.maxAttempts);

    return {
      attemptId: updatedAttempt.id,
      attemptNumber: updatedAttempt.attemptNumber,
      scorePercent,
      correctAnswers: correctCount,
      totalQuestions: total,
      passingScore: course.passingScore,
      passed,
      canRetry,
      attemptsUsed: usedAfter,
      attemptsLeft:
        course.maxAttempts === null ? null : Math.max(0, course.maxAttempts - usedAfter),
      results,
    };
  }

  async getHistory(userId: string, courseId: string): Promise<unknown[]> {
    return this.prisma.quizAttempt.findMany({
      where: { userId, courseId },
      orderBy: { attemptNumber: 'asc' },
      select: {
        id: true,
        attemptNumber: true,
        scorePercent: true,
        passed: true,
        status: true,
        startedAt: true,
        submittedAt: true,
      },
    });
  }

  async getCompletion(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found.');

    const [best, attemptsUsed, totalSlides, viewedCount] = await this.prisma.$transaction([
      this.prisma.quizAttempt.findFirst({
        where: { userId, courseId, status: 'submitted' },
        orderBy: [{ scorePercent: 'desc' }, { submittedAt: 'asc' }],
        select: { id: true, scorePercent: true, passed: true, submittedAt: true },
      }),
      this.prisma.quizAttempt.count({
        where: { userId, courseId, status: { not: 'in_progress' } },
      }),
      this.prisma.slide.count({ where: { courseId } }),
      this.prisma.slideProgress.count({ where: { userId, courseId } }),
    ]);

    return {
      courseId,
      userId,
      completed: best?.passed ?? false,
      bestScore: best?.scorePercent ?? null,
      bestAttemptId: best?.id ?? null,
      completedAt: best?.submittedAt ?? null,
      attemptsUsed,
      slideCount: totalSlides,
      slidesViewed: Math.min(viewedCount, totalSlides),
    };
  }

  async assertAttemptOwner(userId: string, attemptId: string): Promise<void> {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: { userId: true },
    });
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException('Attempt not found.');
    }
  }
}

export type QuizAttemptWhere = Prisma.QuizAttemptWhereInput;

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
