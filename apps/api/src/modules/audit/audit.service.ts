import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    changes?: unknown;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          changes: entry.changes === undefined ? undefined : (entry.changes as object),
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${String(error)}`);
    }
  }

  async list(query: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: {
          ...(query.entityType ? { entityType: query.entityType } : {}),
          ...(query.entityId ? { entityId: query.entityId } : {}),
          ...(query.userId ? { userId: query.userId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: { user: { select: { fullName: true, username: true } } },
      }),
      this.prisma.auditLog.count({
        where: {
          ...(query.entityType ? { entityType: query.entityType } : {}),
          ...(query.entityId ? { entityId: query.entityId } : {}),
          ...(query.userId ? { userId: query.userId } : {}),
        },
      }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        changes: item.changes,
        ipAddress: item.ipAddress,
        createdAt: item.createdAt,
        userName: item.user?.fullName ?? 'System',
        userUsername: item.user?.username ?? null,
      })),
      total,
    };
  }
}
