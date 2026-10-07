import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffQueryDto, StaffDto } from './dto/staff.dto';

const staffInclude = {
  department: true,
  role: true,
} satisfies Prisma.UserInclude;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: StaffQueryDto): Promise<StaffDto[]> {
    const where: Prisma.UserWhereInput = {
      AND: [
        query.search
          ? {
              OR: [
                { username: { contains: query.search, mode: 'insensitive' } },
                { fullName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {},
        query.departmentId ? { departmentId: query.departmentId } : {},
        query.role ? { role: { name: query.role } } : {},
      ],
    };

    const users = await this.prisma.user.findMany({
      where,
      include: staffInclude,
      orderBy: [{ fullName: 'asc' }],
    });
    return users.map(toDto);
  }

  async getById(id: string): Promise<StaffDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: staffInclude,
    });
    if (!user) throw new NotFoundException('Staff member not found.');
    return toDto(user);
  }

  async update(
    id: string,
    editorId: string,
    data: {
      fullName?: string;
      email?: string | null;
      employeeId?: string | null;
      jobTitle?: string | null;
      departmentId?: string | null;
      isActive?: boolean;
    },
  ): Promise<StaffDto> {
    if (id === editorId) {
      throw new BadRequestException('You cannot edit your own staff account here.');
    }
    await this.assertDepartmentExists(data.departmentId);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName,
        email: data.email,
        employeeId: data.employeeId,
        jobTitle: data.jobTitle,
        departmentId: data.departmentId,
        isActive: data.isActive,
      },
      include: staffInclude,
    });
    return toDto(user);
  }

  private async assertDepartmentExists(departmentId?: string | null): Promise<void> {
    if (!departmentId) return;
    const exists = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Department not found.');
  }
}

interface StaffRow {
  id: string;
  username: string;
  adUsername: string | null;
  authProvider: string;
  email: string | null;
  fullName: string;
  employeeId: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  department: { name: string } | null;
  role: { name: string };
  approvalStatus: string;
  isActive: boolean;
  lastLoginAt: Date | null;
}

function toDto(user: StaffRow): StaffDto {
  return {
    id: user.id,
    username: user.username,
    adUsername: user.adUsername,
    authProvider: user.authProvider,
    email: user.email,
    fullName: user.fullName,
    employeeId: user.employeeId,
    jobTitle: user.jobTitle,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    role: user.role.name,
    approvalStatus: user.approvalStatus,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
  };
}
