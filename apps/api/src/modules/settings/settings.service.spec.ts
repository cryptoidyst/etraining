import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      systemSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (ops: unknown) => Promise.all(ops as Promise<unknown>[])),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [SettingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SettingsService);
  });

  it('returns defaults when no rows exist', async () => {
    const result = await service.getAll();
    expect(result).toMatchObject({
      company_name: 'E-Training System',
      default_passing_score: '80',
      default_allow_retake: 'true',
      default_max_attempts: '3',
      deadline_reminder_days: '7',
    });
  });

  it('overlays stored values on top of defaults', async () => {
    prisma.systemSetting.findMany.mockResolvedValue([{ key: 'company_name', value: 'ACME Corp' }]);
    const result = await service.getAll();
    expect(result.company_name).toBe('ACME Corp');
    expect(result.default_passing_score).toBe('80');
  });

  it('upserts only known keys', async () => {
    await service.update({ company_name: 'ACME', bogus_key: 'x' }, 'admin-1');
    expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'company_name' } }),
    );
  });

  it('throws when no valid keys are provided', async () => {
    await expect(service.update({ bogus: 'x' }, 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
