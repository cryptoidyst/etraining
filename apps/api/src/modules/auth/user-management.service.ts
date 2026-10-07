import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalStatusFilter, ManagedUserDto } from './dto/user-management.dto';

@Injectable()
export class UserManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async list(status?: ApprovalStatusFilter): Promise<ManagedUserDto[]> {
    const users = await this.prisma.user.findMany({
      where: status ? { approvalStatus: status } : undefined,
      include: { department: true, role: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(toManagedUser);
  }

  async approve(
    userId: string,
    approverId: string,
    options: { departmentId: string; role?: string },
  ): Promise<ManagedUserDto> {
    await this.assertExists(userId);
    if (userId === approverId) {
      throw new BadRequestException('You cannot approve your own account.');
    }

    const department = await this.prisma.department.findUnique({
      where: { id: options.departmentId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException('Department not found.');

    let roleId: string | undefined;
    if (options.role) {
      const role = await this.prisma.role.findUnique({
        where: { name: options.role },
        select: { id: true },
      });
      if (!role) throw new NotFoundException('Role not found.');
      roleId = role.id;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        approvalStatus: 'approved',
        isActive: true,
        approvedAt: new Date(),
        approvedByUserId: approverId,
        rejectionReason: null,
        departmentId: options.departmentId,
        roleId,
      },
      include: { department: true, role: true },
    });
    return toManagedUser(user);
  }

  async reject(userId: string, approverId: string, reason?: string): Promise<ManagedUserDto> {
    await this.assertExists(userId);
    if (userId === approverId) {
      throw new BadRequestException('You cannot reject your own account.');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        approvalStatus: 'rejected',
        approvedByUserId: approverId,
        rejectionReason: reason ?? null,
      },
      include: { department: true, role: true },
    });
    return toManagedUser(user);
  }

  private async assertExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('User not found.');
    }
  }
}

interface ManagedUserRow {
  id: string;
  username: string;
  adUsername: string | null;
  authProvider: string;
  email: string | null;
  fullName: string;
  department: { name: string } | null;
  role: { name: string };
  approvalStatus: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

function toManagedUser(user: ManagedUserRow): ManagedUserDto {
  return {
    id: user.id,
    username: user.username,
    adUsername: user.adUsername,
    authProvider: user.authProvider,
    email: user.email,
    fullName: user.fullName,
    departmentName: user.department?.name ?? null,
    role: user.role.name,
    approvalStatus: user.approvalStatus,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
