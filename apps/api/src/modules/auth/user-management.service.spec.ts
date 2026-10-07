import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UserManagementService', () => {
  let service: UserManagementService;
  let prisma: {
    user: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    department: { findUnique: jest.Mock };
    role: { findUnique: jest.Mock };
  };

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    username: 'meon',
    adUsername: null,
    authProvider: 'local',
    email: null,
    fullName: 'muhammad meon',
    departmentId: null,
    department: null,
    role: { name: 'staff' },
    approvalStatus: 'pending',
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      department: { findUnique: jest.fn() },
      role: { findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [UserManagementService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UserManagementService);
  });

  it('approves a user and assigns the given department', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.department.findUnique.mockResolvedValue({ id: 'dept-1' });
    prisma.user.update.mockResolvedValue(
      row({ approvalStatus: 'approved', department: { name: 'IT' } }),
    );

    const result = await service.approve('user-1', 'admin-1', { departmentId: 'dept-1' });

    expect(result.approvalStatus).toBe('approved');
    expect(result.departmentName).toBe('IT');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ departmentId: 'dept-1' }),
      }),
    );
  });

  it('assigns a role when provided', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.department.findUnique.mockResolvedValue({ id: 'dept-1' });
    prisma.role.findUnique.mockResolvedValue({ id: 'role-admin' });
    prisma.user.update.mockResolvedValue(
      row({ approvalStatus: 'approved', role: { name: 'administrator' } }),
    );

    const result = await service.approve('user-1', 'admin-1', {
      departmentId: 'dept-1',
      role: 'administrator',
    });

    expect(result.role).toBe('administrator');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: 'role-admin' }),
      }),
    );
  });

  it('rejects an unknown department', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.department.findUnique.mockResolvedValue(null);

    await expect(
      service.approve('user-1', 'admin-1', { departmentId: 'nope' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an unknown role', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.department.findUnique.mockResolvedValue({ id: 'dept-1' });
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(
      service.approve('user-1', 'admin-1', { departmentId: 'dept-1', role: 'ghost' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound approving a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.approve('nope', 'admin-1', { departmentId: 'dept-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects self-approval', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1' });
    await expect(
      service.approve('admin-1', 'admin-1', { departmentId: 'dept-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects self-rejection', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1' });
    await expect(service.reject('admin-1', 'admin-1', 'test')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
