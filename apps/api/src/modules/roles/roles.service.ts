import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto, RoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
    return roles.map(toRoleDto);
  }

  async getById(id: string): Promise<RoleDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found.');
    return toRoleDto(role);
  }

  async create(dto: CreateRoleDto): Promise<RoleDto> {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists.`);
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        rolePermissions: dto.permissionCodes
          ? { create: await this.resolvePermissionCreates(dto.permissionCodes) }
          : undefined,
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return toRoleDto(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleDto> {
    await this.assertExists(id);
    const role = await this.prisma.role.update({
      where: { id },
      data: {
        description: dto.description,
        ...(dto.permissionCodes
          ? {
              rolePermissions: {
                deleteMany: {},
                create: await this.resolvePermissionCreates(dto.permissionCodes),
              },
            }
          : {}),
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return toRoleDto(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found.');
    if (role.isSystem) {
      throw new ConflictException('System roles cannot be deleted.');
    }
    if (role._count.users > 0) {
      throw new ConflictException(
        `Role "${role.name}" is assigned to ${role._count.users} user(s) and cannot be deleted.`,
      );
    }
    await this.prisma.role.delete({ where: { id } });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
      select: { code: true, description: true },
    });
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.role.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Role not found.');
  }

  private async resolvePermissionCreates(codes: string[]) {
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true },
    });
    if (permissions.length !== new Set(codes).size) {
      throw new NotFoundException('One or more permission codes are invalid.');
    }
    return permissions.map((p) => ({ permissionId: p.id }));
  }
}

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: { permission: { code: string } }[];
}

function toRoleDto(role: RoleRow): RoleDto {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.rolePermissions.map((rp) => rp.permission.code),
  };
}
