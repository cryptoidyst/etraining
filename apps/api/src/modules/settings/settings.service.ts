import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const SETTING_KEYS = [
  'company_name',
  'default_passing_score',
  'default_allow_retake',
  'default_max_attempts',
  'deadline_reminder_days',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

const DEFAULTS: Record<SettingKey, string> = {
  company_name: 'E-Training System',
  default_passing_score: '80',
  default_allow_retake: 'true',
  default_max_attempts: '3',
  deadline_reminder_days: '7',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.systemSetting.findMany();
    const result: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async update(updates: Record<string, string>, userId: string): Promise<Record<string, string>> {
    const validKeys = Object.keys(updates).filter((key): key is SettingKey => key in DEFAULTS);
    if (validKeys.length === 0) {
      throw new NotFoundException('No valid setting keys provided.');
    }
    await this.prisma.$transaction(
      validKeys.map((key) =>
        this.prisma.systemSetting.upsert({
          where: { key },
          update: { value: updates[key], updatedById: userId },
          create: { key, value: updates[key], updatedById: userId },
        }),
      ),
    );
    return this.getAll();
  }
}
