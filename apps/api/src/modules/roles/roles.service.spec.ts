import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: {
    role: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    permission: { findMany: jest.Mock };
  };

  const roleRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'role-1',
    name: 'staff',
    description: 'Staff role',
    isSystem: true,
    rolePermissions: [{ permission: { code: 'quiz.take' } }],
    _count: { users: 0 },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      role: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      permission: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [RolesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RolesService);
  });

  it('lists roles mapped to permission codes', async () => {
    prisma.role.findMany.mockResolvedValue([roleRow()]);
    const result = await service.list();
    expect(result).toEqual([
      {
        id: 'role-1',
        name: 'staff',
        description: 'Staff role',
        isSystem: true,
        permissions: ['quiz.take'],
      },
    ]);
  });

  it('throws NotFound when getting a missing role', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate role names on create', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1' });
    await expect(service.create({ name: 'staff' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a role with resolved permission codes', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    prisma.permission.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.role.create.mockResolvedValue(roleRow());

    await service.create({ name: 'manager', permissionCodes: ['courses.read'] });

    expect(prisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'manager',
          rolePermissions: { create: [{ permissionId: 'p1' }] },
        }),
      }),
    );
  });

  it('fails create when a permission code is unknown', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    prisma.permission.findMany.mockResolvedValue([]);
    await expect(
      service.create({ name: 'manager', permissionCodes: ['bogus.code'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting a system role', async () => {
    prisma.role.findUnique.mockResolvedValue(roleRow({ isSystem: true }));
    await expect(service.remove('role-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks deleting a role still assigned to users', async () => {
    prisma.role.findUnique.mockResolvedValue(roleRow({ isSystem: false, _count: { users: 2 } }));
    await expect(service.remove('role-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes an unassigned custom role', async () => {
    prisma.role.findUnique.mockResolvedValue(roleRow({ isSystem: false }));
    await service.remove('role-1');
    expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: 'role-1' } });
  });
});
