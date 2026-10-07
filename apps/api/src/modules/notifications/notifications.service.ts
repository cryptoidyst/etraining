import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notifyCourseAssigned(
    recipients: { userId: string }[],
    course: { id: string; title: string },
    dueDate: Date | null,
  ) {
    if (recipients.length === 0) return;
    const due = dueDate ? ` Due ${dueDate.toLocaleDateString()}.` : '';
    await this.prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.userId,
        courseId: course.id,
        type: 'course_assigned' as const,
        title: 'New course assigned',
        message: `You have been assigned "${course.title}".${due} Open My Training to start.`,
        status: 'sent' as const,
        sentAt: new Date(),
      })),
    });
    this.logger.log(`Queued ${recipients.length} course_assigned notification(s) for ${course.id}`);
  }

  async list(userId: string, query: { unreadOnly?: boolean; limit?: number } = {}) {
    return this.prisma.notification.findMany({
      where: { userId, ...(query.unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(query.limit ?? 50, 100),
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
        readAt: true,
        course: { select: { id: true, title: true } },
      },
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });
    if (!notification || notification.userId !== userId) return null;
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
