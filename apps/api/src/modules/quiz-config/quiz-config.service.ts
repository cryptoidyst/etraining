import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachedQuestionDto, QUIZ_MIN_QUESTIONS, QuizConfigDto } from './dto/quiz-config.dto';

@Injectable()
export class QuizConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists the question templates of a course (optionally one set). Questions
   * are course-owned; the set/order lives on the question itself.
   */
  async getAttached(courseId: string, setIndex?: number): Promise<AttachedQuestionDto[]> {
    await this.assertCourseExists(courseId);
    const rows = await this.prisma.question.findMany({
      where: { courseId, ...(setIndex !== undefined ? { setIndex } : {}) },
      include: { options: { orderBy: { orderIndex: 'asc' } } },
      orderBy: [{ setIndex: 'asc' }, { orderIndex: 'asc' }],
    });
    return rows.map((q) => ({
      questionId: q.id,
      orderIndex: q.orderIndex,
      setIndex: q.setIndex,
      type: q.type,
      text: q.text,
      imagePath: q.imagePath,
      optionTexts: q.options.map((o) => o.text),
    }));
  }

  async getConfig(courseId: string): Promise<QuizConfigDto> {
    await this.assertCourseExists(courseId);
    const [course, rows] = await this.prisma.$transaction([
      this.prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: {
          passingScore: true,
          allowRetake: true,
          maxAttempts: true,
          shuffleQuestions: true,
          shuffleOptions: true,
        },
      }),
      this.prisma.question.findMany({
        where: { courseId },
        select: { setIndex: true },
      }),
    ]);

    const counts = new Map<number, number>();
    for (const row of rows) {
      counts.set(row.setIndex, (counts.get(row.setIndex) ?? 0) + 1);
    }
    const sets = [...counts.entries()]
      .map(([setIndex, count]) => ({ setIndex, count }))
      .sort((a, b) => a.setIndex - b.setIndex);

    const hasValidSet = sets.some((s) => s.count >= QUIZ_MIN_QUESTIONS);

    return {
      courseId,
      questionCount: rows.length,
      minQuestions: QUIZ_MIN_QUESTIONS,
      sets,
      shuffleQuestions: course.shuffleQuestions,
      shuffleOptions: course.shuffleOptions,
      passingScore: course.passingScore,
      allowRetake: course.allowRetake,
      maxAttempts: course.maxAttempts,
      isValid: hasValidSet,
    };
  }

  async updateConfig(
    courseId: string,
    data: {
      passingScore?: number;
      allowRetake?: boolean;
      maxAttempts?: number | null;
      shuffleQuestions?: boolean;
      shuffleOptions?: boolean;
    },
  ): Promise<QuizConfigDto> {
    await this.assertCourseExists(courseId);
    await this.prisma.course.update({
      where: { id: courseId },
      data,
    });
    return this.getConfig(courseId);
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const exists = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Course not found.');
  }
}
