import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: {
    department: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'dept-1',
    name: 'IT',
    code: 'it',
    description: null,
    isActive: true,
    _count: { users: 0 },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      department: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [DepartmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(DepartmentsService);
  });

  it('creates a department with a free code', async () => {
    prisma.department.findUnique.mockResolvedValue(null);
    prisma.department.create.mockResolvedValue(row());

    const result = await service.create({ name: 'IT', code: 'it' });

    expect(result.staffCount).toBe(0);
    expect(prisma.department.create).toHaveBeenCalled();
  });

  it('rejects duplicate department codes', async () => {
    prisma.department.findUnique.mockResolvedValue({ id: 'dept-1' });
    await expect(service.create({ name: 'IT', code: 'it' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('blocks deleting a department that still has staff', async () => {
    prisma.department.findUnique.mockResolvedValue(row({ _count: { users: 3 } }));
    await expect(service.remove('dept-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes an empty department', async () => {
    prisma.department.findUnique.mockResolvedValue(row());
    await service.remove('dept-1');
    expect(prisma.department.delete).toHaveBeenCalledWith({ where: { id: 'dept-1' } });
  });

  it('throws NotFound for a missing department', async () => {
    prisma.department.findUnique.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
