import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      notification: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('creates one course_assigned notification per recipient', async () => {
    await service.notifyCourseAssigned(
      [{ userId: 'u1' }, { userId: 'u2' }],
      { id: 'c1', title: 'Course' },
      new Date('2026-10-01'),
    );

    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    const data = prisma.notification.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      userId: 'u1',
      courseId: 'c1',
      type: 'course_assigned',
      status: 'sent',
    });
    expect(data[0].message).toContain('Course');
  });

  it('skips creation when no recipients', async () => {
    await service.notifyCourseAssigned([], { id: 'c1', title: 'C' }, null);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('filters unread when requested', async () => {
    await service.list('u1', { unreadOnly: true });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', isRead: false } }),
    );
  });

  it('marks one notification read only for the owner', async () => {
    prisma.notification.findUnique.mockResolvedValue({ userId: 'someone-else' });
    const result = await service.markRead('u1', 'n1');
    expect(result).toBeNull();
    expect(prisma.notification.update).not.toHaveBeenCalled();

    prisma.notification.findUnique.mockResolvedValue({ userId: 'u1' });
    prisma.notification.update.mockResolvedValue({ id: 'n1' });
    await service.markRead('u1', 'n1');
    expect(prisma.notification.update).toHaveBeenCalled();
  });

  it('marks all read via updateMany scoped to the user', async () => {
    await service.markAllRead('u1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isRead: false },
      data: expect.objectContaining({ isRead: true }),
    });
  });
});
