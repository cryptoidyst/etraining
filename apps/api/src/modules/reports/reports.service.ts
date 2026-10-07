import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CourseReportDto,
  CourseReportRow,
  DashboardReportDto,
  OverdueItemDto,
  StaffTranscriptDto,
  StaffTranscriptItemDto,
} from './dto/reports.dto';

type RowStatus = 'completed' | 'in_progress' | 'not_started' | 'overdue';

interface AttemptSummary {
  bestScore: number | null;
  passed: boolean;
  attemptsUsed: number;
  lastAttemptAt: Date | null;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<DashboardReportDto> {
    const [
      totalUsers,
      pendingApprovals,
      totalCourses,
      publishedCourses,
      totalAssignments,
      overdueAssignments,
      attempts,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({
        where: {
          isActive: true,
          role: { name: { not: 'administrator' } },
        },
      }),
      this.prisma.user.count({
        where: {
          approvalStatus: 'pending',
          role: { name: { not: 'administrator' } },
        },
      }),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { status: 'published' } }),
      this.prisma.assignment.count(),
      this.prisma.assignment.count({ where: { dueDate: { lt: new Date() } } }),
      this.prisma.quizAttempt.findMany({
        where: { status: 'submitted' },
        select: { userId: true, courseId: true, scorePercent: true, passed: true },
      }),
    ]);

    const bestByPair = new Map<string, number>();
    let passedPairs = 0;
    for (const a of attempts) {
      const key = `${a.userId}:${a.courseId}`;
      const score = a.scorePercent ?? 0;
      const current = bestByPair.get(key);
      if (current === undefined || score > current) bestByPair.set(key, score);
      if (a.passed) passedPairs += 1;
    }
    void passedPairs;
    const completedAssignments = passedPairs;
    const averageBestScore =
      bestByPair.size === 0
        ? null
        : Math.round([...bestByPair.values()].reduce((sum, s) => sum + s, 0) / bestByPair.size);

    return {
      totalUsers,
      pendingApprovals,
      totalCourses,
      publishedCourses,
      totalAssignments,
      completedAssignments,
      completionRate:
        totalAssignments === 0 ? 0 : Math.round((completedAssignments / totalAssignments) * 100),
      overdueAssignments,
      averageBestScore,
      totalAttempts: attempts.length,
    };
  }

  async getCourseReport(
    courseId: string,
    pagination: { departmentId?: string; limit?: number; offset?: number } = {},
  ): Promise<CourseReportDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });
    if (!course) throw new NotFoundException('Course not found.');

    const limit = pagination.limit ?? 500;
    const offset = pagination.offset ?? 0;

    const assignments = await this.prisma.assignment.findMany({
      where: {
        courseId,
        ...(pagination.departmentId ? { user: { departmentId: pagination.departmentId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        userId: true,
        dueDate: true,
        user: {
          select: {
            id: true,
            fullName: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    const userIds = assignments.map((a) => a.userId);
    const [slideCount, progressRows, attempts] = await Promise.all([
      this.prisma.slide.count({ where: { courseId } }),
      this.prisma.slideProgress.groupBy({
        by: ['userId'],
        where: { courseId, userId: { in: userIds } },
        _count: { _all: true },
      }),
      this.prisma.quizAttempt.findMany({
        where: { courseId, userId: { in: userIds }, status: 'submitted' },
        orderBy: [{ scorePercent: 'desc' }, { submittedAt: 'asc' }],
        select: {
          userId: true,
          scorePercent: true,
          passed: true,
          submittedAt: true,
        },
      }),
    ]);

    const viewedByUser = new Map<string, number>();
    for (const row of progressRows) {
      viewedByUser.set(row.userId, row._count._all);
    }
    const bestByUser = new Map<string, AttemptSummary>();
    for (const a of attempts) {
      const existing = bestByUser.get(a.userId);
      if (!existing) {
        bestByUser.set(a.userId, {
          bestScore: a.scorePercent,
          passed: a.passed ?? false,
          attemptsUsed: 1,
          lastAttemptAt: a.submittedAt,
        });
      } else {
        existing.attemptsUsed += 1;
        if ((a.scorePercent ?? 0) > (existing.bestScore ?? 0)) {
          existing.bestScore = a.scorePercent;
        }
        if (a.passed) existing.passed = true;
      }
    }

    const now = new Date();
    const items: CourseReportRow[] = assignments.map((a) => {
      const best = bestByUser.get(a.userId);
      const slidesViewed = Math.min(viewedByUser.get(a.userId) ?? 0, slideCount);
      const isOverdue = a.dueDate !== null && a.dueDate < now && !best?.passed;
      let status: RowStatus;
      if (best?.passed) status = 'completed';
      else if (isOverdue) status = 'overdue';
      else if (slidesViewed > 0 || best) status = 'in_progress';
      else status = 'not_started';

      return {
        userId: a.user.id,
        fullName: a.user.fullName,
        departmentName: a.user.department?.name ?? null,
        dueDate: a.dueDate,
        status,
        slidesViewed,
        slideCount,
        bestScore: best?.bestScore ?? null,
        attemptsUsed: best?.attemptsUsed ?? 0,
        passed: best?.passed ?? false,
        completedAt: best?.passed ? (best.lastAttemptAt ?? null) : null,
      };
    });

    const scored = items.filter((i) => i.bestScore !== null);
    return {
      courseId,
      courseTitle: course.title,
      items,
      total: items.length,
      completed: items.filter((i) => i.status === 'completed').length,
      inProgress: items.filter((i) => i.status === 'in_progress').length,
      notStarted: items.filter((i) => i.status === 'not_started').length,
      overdue: items.filter((i) => i.status === 'overdue').length,
      averageScore:
        scored.length === 0
          ? null
          : Math.round(scored.reduce((sum, i) => sum + (i.bestScore ?? 0), 0) / scored.length),
    };
  }

  async getStaffTranscript(userId: string): Promise<StaffTranscriptDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        department: { select: { name: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found.');

    const assignments = await this.prisma.assignment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        dueDate: true,
        course: {
          select: { id: true, title: true, _count: { select: { slides: true } } },
        },
      },
    });

    const [progressRows, attempts] = await Promise.all([
      this.prisma.slideProgress.groupBy({
        by: ['courseId'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.quizAttempt.findMany({
        where: { userId, status: 'submitted' },
        orderBy: [{ scorePercent: 'desc' }, { submittedAt: 'asc' }],
        select: {
          courseId: true,
          scorePercent: true,
          passed: true,
          submittedAt: true,
        },
      }),
    ]);

    const viewedByCourse = new Map(progressRows.map((row) => [row.courseId, row._count._all]));
    const bestByCourse = new Map<string, AttemptSummary>();
    for (const a of attempts) {
      const existing = bestByCourse.get(a.courseId);
      if (!existing) {
        bestByCourse.set(a.courseId, {
          bestScore: a.scorePercent,
          passed: a.passed ?? false,
          attemptsUsed: 1,
          lastAttemptAt: a.submittedAt,
        });
      } else {
        existing.attemptsUsed += 1;
        if ((a.scorePercent ?? 0) > (existing.bestScore ?? 0)) {
          existing.bestScore = a.scorePercent;
        }
        if (a.passed) existing.passed = true;
      }
    }

    const now = new Date();
    const items: StaffTranscriptItemDto[] = assignments.map((a) => {
      const best = bestByCourse.get(a.course.id);
      const slideCount = a.course._count.slides;
      const slidesViewed = Math.min(viewedByCourse.get(a.course.id) ?? 0, slideCount);
      const isOverdue = a.dueDate !== null && a.dueDate < now && !best?.passed;
      let status: RowStatus;
      if (best?.passed) status = 'completed';
      else if (isOverdue) status = 'overdue';
      else if (slidesViewed > 0 || best) status = 'in_progress';
      else status = 'not_started';

      return {
        courseId: a.course.id,
        courseTitle: a.course.title,
        status,
        slidesViewed,
        slideCount,
        bestScore: best?.bestScore ?? null,
        attemptsUsed: best?.attemptsUsed ?? 0,
        passed: best?.passed ?? false,
        dueDate: a.dueDate,
        completedAt: best?.passed ? (best.lastAttemptAt ?? null) : null,
        lastAttemptAt: best?.lastAttemptAt ?? null,
      };
    });

    return {
      userId: user.id,
      fullName: user.fullName,
      departmentName: user.department?.name ?? null,
      jobTitle: user.jobTitle,
      assignedCourses: items.length,
      completedCourses: items.filter((i) => i.status === 'completed').length,
      items,
    };
  }

  async getOverdue(pagination: { departmentId?: string; limit?: number; offset?: number } = {}) {
    const now = new Date();
    const limit = pagination.limit ?? 100;
    const offset = pagination.offset ?? 0;

    const assignments = await this.prisma.assignment.findMany({
      where: {
        dueDate: { lt: now },
        ...(pagination.departmentId ? { user: { departmentId: pagination.departmentId } } : {}),
      },
      orderBy: { dueDate: 'asc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        courseId: true,
        userId: true,
        dueDate: true,
        course: { select: { title: true } },
        user: {
          select: { fullName: true, department: { select: { name: true } } },
        },
      },
    });

    if (assignments.length === 0) return [] as OverdueItemDto[];

    const courseIds = [...new Set(assignments.map((a) => a.courseId))];
    const userIds = [...new Set(assignments.map((a) => a.userId))];

    const [slides, progressRows, passedAttempts] = await Promise.all([
      this.prisma.slide.groupBy({
        by: ['courseId'],
        where: { courseId: { in: courseIds } },
        _count: { _all: true },
      }),
      this.prisma.slideProgress.groupBy({
        by: ['userId', 'courseId'],
        where: { userId: { in: userIds }, courseId: { in: courseIds } },
        _count: { _all: true },
      }),
      this.prisma.quizAttempt.findMany({
        where: { userId: { in: userIds }, courseId: { in: courseIds }, passed: true },
        select: { userId: true, courseId: true },
        distinct: ['userId', 'courseId'],
      }),
    ]);

    const slideCountByCourse = new Map(slides.map((s) => [s.courseId, s._count._all]));
    const viewedKey = (userId: string, courseId: string) => `${userId}:${courseId}`;
    const viewedByPair = new Map<string, number>();
    for (const row of progressRows) {
      viewedByPair.set(viewedKey(row.userId, row.courseId), row._count._all);
    }
    const passedPairs = new Set(passedAttempts.map((a) => viewedKey(a.userId, a.courseId)));

    return assignments
      .filter((a) => !passedPairs.has(viewedKey(a.userId, a.courseId)))
      .map((a) => ({
        assignmentId: a.id,
        courseId: a.courseId,
        courseTitle: a.course.title,
        userId: a.userId,
        fullName: a.user.fullName,
        departmentName: a.user.department?.name ?? null,
        dueDate: a.dueDate as Date,
        slidesViewed: Math.min(
          viewedByPair.get(viewedKey(a.userId, a.courseId)) ?? 0,
          slideCountByCourse.get(a.courseId) ?? 0,
        ),
        slideCount: slideCountByCourse.get(a.courseId) ?? 0,
        passed: false,
        daysOverdue: Math.max(
          0,
          Math.floor((now.getTime() - (a.dueDate as Date).getTime()) / 86_400_000),
        ),
      }));
  }
}
