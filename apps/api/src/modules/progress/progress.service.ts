import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CourseProgressDto, SlideViewDto } from './dto/progress.dto';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotently records that the user viewed a slide of this course.
   * The slide must belong to the course in the path.
   */
  async recordSlideView(userId: string, courseId: string, slideId: string): Promise<SlideViewDto> {
    const slide = await this.prisma.slide.findFirst({
      where: { id: slideId, courseId },
      select: { id: true },
    });
    if (!slide) {
      throw new NotFoundException('Slide not found in this course.');
    }

    const record = await this.prisma.slideProgress.upsert({
      where: { userId_slideId: { userId, slideId } },
      update: {},
      create: { userId, slideId, courseId },
      select: { slideId: true, viewedAt: true },
    });
    return { slideId: record.slideId, viewedAt: record.viewedAt };
  }

  /**
   * Aggregated progress for a user on a course, including the quiz gate.
   */
  async getCourseProgress(userId: string, courseId: string): Promise<CourseProgressDto> {
    await this.assertCourseExists(courseId);

    const [totalSlides, viewed] = await this.prisma.$transaction([
      this.prisma.slide.count({ where: { courseId } }),
      this.prisma.slideProgress.findMany({
        where: { userId, courseId },
        select: { slideId: true, viewedAt: true },
        orderBy: { viewedAt: 'asc' },
      }),
    ]);

    const viewedSlides = viewed.length;
    return {
      courseId,
      totalSlides,
      viewedSlides,
      percent: totalSlides === 0 ? 0 : Math.round((viewedSlides / totalSlides) * 100),
      allSlidesViewed: totalSlides > 0 && viewedSlides >= totalSlides,
      viewed,
    };
  }

  /**
   * Quiz gate used by Module 8/10: quiz is locked until every slide is viewed.
   */
  async isQuizUnlocked(userId: string, courseId: string): Promise<boolean> {
    const [totalSlides, viewedCount] = await this.prisma.$transaction([
      this.prisma.slide.count({ where: { courseId } }),
      this.prisma.slideProgress.count({ where: { userId, courseId } }),
    ]);
    return totalSlides > 0 && viewedCount >= totalSlides;
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const exists = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Course not found.');
  }
}
