import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(
    adminId: string,
    input: {
      courseId: string;
      targetType: 'user' | 'department';
      targetId: string;
      dueDate?: string | null;
    },
  ): Promise<{ created: number; skipped: number }> {
    const course = await this.prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found.');

    const dueDate = input.dueDate ? new Date(input.dueDate) : null;

    let recipientIds: string[];
    if (input.targetType === 'user') {
      const user = await this.prisma.user.findUnique({
        where: { id: input.targetId },
        select: { id: true, isActive: true, approvalStatus: true },
      });
      if (!user || !user.isActive || user.approvalStatus !== 'approved') {
        throw new NotFoundException('Active approved user not found.');
      }
      recipientIds = [user.id];
    } else {
      const department = await this.prisma.department.findUnique({
        where: { id: input.targetId },
        select: { id: true },
      });
      if (!department) throw new NotFoundException('Department not found.');
      const members = await this.prisma.user.findMany({
        where: {
          departmentId: input.targetId,
          isActive: true,
          approvalStatus: 'approved',
        },
        select: { id: true },
      });
      recipientIds = members.map((m) => m.id);
    }

    if (recipientIds.length === 0) {
      throw new BadRequestException('Target has no active approved members.');
    }

    const existing = await this.prisma.assignment.findMany({
      where: { courseId: input.courseId, userId: { in: recipientIds } },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map((e) => e.userId));
    const freshIds = recipientIds.filter((id) => !existingSet.has(id));

    if (freshIds.length === 0) {
      throw new ConflictException('All selected users already have this course assigned.');
    }

    await this.prisma.assignment.createMany({
      data: freshIds.map((userId) => ({
        courseId: input.courseId,
        userId,
        targetType: input.targetType,
        targetId: input.targetId,
        assignedById: adminId,
        dueDate,
      })),
    });

    const courseTitle = await this.prisma.course.findUniqueOrThrow({
      where: { id: input.courseId },
      select: { title: true },
    });
    await this.notifications
      .notifyCourseAssigned(
        freshIds.map((userId) => ({ userId })),
        { id: input.courseId, title: courseTitle.title },
        dueDate,
      )
      .catch(() => undefined);

    await this.audit.record({
      userId: adminId,
      action: 'assign',
      entityType: 'assignment',
      entityId: input.courseId,
      changes: {
        targetType: input.targetType,
        targetId: input.targetId,
        created: freshIds.length,
        skipped: existingSet.size,
        dueDate: dueDate?.toISOString() ?? null,
      },
    });

    return { created: freshIds.length, skipped: existingSet.size };
  }

  async list(query: {
    courseId?: string;
    userId?: string;
    departmentId?: string;
    overdue?: string;
  }) {
    const where: {
      courseId?: string;
      userId?: string;
      user?: { departmentId?: string };
      dueDate?: { lt: Date };
    } = {};
    if (query.courseId) where.courseId = query.courseId;
    if (query.userId) where.userId = query.userId;
    if (query.departmentId) where.user = { departmentId: query.departmentId };
    if (query.overdue === 'overdue') {
      where.dueDate = { lt: new Date() };
    }

    return this.prisma.assignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { title: true } },
        user: {
          select: { fullName: true, department: { select: { name: true } } },
        },
      },
    });
  }

  async listForCourse(
    courseId: string,
    pagination: { limit?: number; offset?: number } = {},
  ): Promise<{ items: unknown[]; total: number }> {
    await this.assertCourseExists(courseId);
    const limit = pagination.limit ?? 100;
    const offset = pagination.offset ?? 0;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.assignment.findMany({
        where: { courseId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          userId: true,
          dueDate: true,
          createdAt: true,
          user: {
            select: { fullName: true, department: { select: { name: true } } },
          },
        },
      }),
      this.prisma.assignment.count({ where: { courseId } }),
    ]);
    return {
      items: rows.map((row) => ({
        userId: row.userId,
        fullName: row.user.fullName,
        departmentName: row.user.department?.name ?? null,
        dueDate: row.dueDate,
        createdAt: row.createdAt,
      })),
      total,
    };
  }

  async updateDueDate(id: string, dueDate: string | null | undefined) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found.');
    const updated = await this.prisma.assignment.update({
      where: { id },
      data: { dueDate: dueDate ? new Date(dueDate) : null },
    });
    return updated;
  }

  async remove(id: string): Promise<void> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      select: { id: true, userId: true, courseId: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found.');
    await this.prisma.assignment.delete({ where: { id } });
    await this.audit.record({
      action: 'delete',
      entityType: 'assignment',
      entityId: id,
      changes: { userId: assignment.userId, courseId: assignment.courseId },
    });
  }

  async myTraining(userId: string) {
    const assignments = await this.prisma.assignment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            _count: { select: { slides: true, questions: true } },
          },
        },
      },
    });

    const progressRows = await this.prisma.slideProgress.groupBy({
      by: ['courseId'],
      where: { userId },
      _count: { _all: true },
    });

    const passedRows = await this.prisma.quizAttempt.findMany({
      where: { userId, passed: true, status: 'submitted' },
      select: { courseId: true },
      distinct: ['courseId'],
    });

    const viewedByCourse = new Map(progressRows.map((row) => [row.courseId, row._count._all]));
    const passedCourses = new Set(passedRows.map((row) => row.courseId));

    return assignments.map((a) => {
      const slideCount = a.course._count.slides;
      const slidesViewed = viewedByCourse.get(a.courseId) ?? 0;
      return {
        assignmentId: a.id,
        courseId: a.course.id,
        courseTitle: a.course.title,
        courseDescription: a.course.description,
        dueDate: a.dueDate,
        assignedAt: a.createdAt,
        slideCount,
        slidesViewed: Math.min(slidesViewed, slideCount),
        allSlidesViewed: slideCount > 0 && slidesViewed >= slideCount,
        quizQuestionCount: a.course._count.questions,
        quizPassed: passedCourses.has(a.courseId),
      };
    });
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const exists = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Course not found.');
  }
}
