import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepartmentDto, DepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeInactive = false): Promise<DepartmentDto[]> {
    const departments = await this.prisma.department.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
    return departments.map(toDto);
  }

  async getById(id: string): Promise<DepartmentDto> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!department) throw new NotFoundException('Department not found.');
    return toDto(department);
  }

  async create(dto: CreateDepartmentDto): Promise<DepartmentDto> {
    await this.assertCodeAvailable(dto.code);
    const department = await this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        code: dto.code,
        description: dto.description ?? null,
      },
      include: { _count: { select: { users: true } } },
    });
    return toDto(department);
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<DepartmentDto> {
    await this.assertExists(id);
    const department = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
      },
      include: { _count: { select: { users: true } } },
    });
    return toDto(department);
  }

  async remove(id: string): Promise<void> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!department) throw new NotFoundException('Department not found.');
    if (department._count.users > 0) {
      throw new ConflictException(
        `Department "${department.name}" still has ${department._count.users} staff member(s) and cannot be deleted.`,
      );
    }
    await this.prisma.department.delete({ where: { id } });
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Department not found.');
  }

  private async assertCodeAvailable(code: string): Promise<void> {
    const existing = await this.prisma.department.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Department code "${code}" is already in use.`);
    }
  }
}

interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  _count: { users: number };
}

function toDto(department: DepartmentRow): DepartmentDto {
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description,
    isActive: department.isActive,
    staffCount: department._count.users,
  };
}
