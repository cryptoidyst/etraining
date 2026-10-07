import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AdUserRecord } from './ad/ad-directory.interface';

export type AppRole = 'administrator' | 'staff';
export type AuthProvider = 'local' | 'ad';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface SyncedUser {
  id: string;
  username: string;
  adUsername: string | null;
  authProvider: AuthProvider;
  email: string | null;
  fullName: string;
  employeeId: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  role: AppRole;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  lastLoginAt: Date | null;
}

@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Map an AD record to an application role based on AD group membership.
   * Administrator takes precedence over staff. Returns null when the user is
   * in neither mapped group (access is denied by the caller).
   */
  resolveRole(groups: string[]): AppRole | null {
    const adminGroup = this.config.get<string>('ad.groupAdmin', 'Training-Admins');
    const staffGroup = this.config.get<string>('ad.groupStaff', 'Training-Staff');
    const lookup = groups.map((g) => g.toLowerCase());

    if (lookup.includes(adminGroup.toLowerCase())) return 'administrator';
    if (lookup.includes(staffGroup.toLowerCase())) return 'staff';
    return null;
  }

  /**
   * Upsert the local user row from an AD record. No AD password is ever stored.
   * Throws ForbiddenException when the account is disabled or has no mapped role.
   */
  async syncFromAd(adUser: AdUserRecord): Promise<SyncedUser> {
    if (!adUser.enabled) {
      throw new ForbiddenException('Your Active Directory account is disabled.');
    }

    const appRole = this.resolveRole(adUser.groups);
    if (!appRole) {
      throw new ForbiddenException('Your account is not a member of an authorized training group.');
    }

    const role = await this.prisma.role.upsert({
      where: { name: appRole },
      update: {},
      create: { name: appRole, description: roleDescription(appRole) },
    });

    const department = adUser.department ? await this.resolveDepartment(adUser.department) : null;

    const user = await this.prisma.user.upsert({
      where: { adUsername: adUser.username },
      update: {
        username: adUser.username,
        email: adUser.email,
        fullName: adUser.fullName,
        employeeId: adUser.employeeId,
        jobTitle: adUser.jobTitle,
        departmentId: department?.id ?? null,
        roleId: role.id,
        authProvider: 'ad',
        approvalStatus: 'approved',
        approvedAt: new Date(),
        isActive: true,
        lastLoginAt: new Date(),
      },
      create: {
        username: adUser.username,
        adUsername: adUser.username,
        email: adUser.email,
        fullName: adUser.fullName,
        employeeId: adUser.employeeId,
        jobTitle: adUser.jobTitle,
        departmentId: department?.id ?? null,
        roleId: role.id,
        authProvider: 'ad',
        approvalStatus: 'approved',
        approvedAt: new Date(),
        isActive: true,
        lastLoginAt: new Date(),
      },
      include: { department: true, role: true },
    });

    return toSyncedUser(user);
  }

  /**
   * Refresh an existing local user row against AD after a successful bind.
   * Used when a locally-registered account also exists in the directory.
   */
  async syncLinkedAdUser(userId: string, adUser: AdUserRecord): Promise<SyncedUser> {
    if (!adUser.enabled) {
      throw new ForbiddenException('Your Active Directory account is disabled.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        adUsername: adUser.username,
        email: adUser.email ?? undefined,
        fullName: adUser.fullName,
        employeeId: adUser.employeeId ?? undefined,
        jobTitle: adUser.jobTitle ?? undefined,
        isActive: true,
        lastLoginAt: new Date(),
      },
      include: { department: true, role: true },
    });

    return toSyncedUser(user);
  }

  private async resolveDepartment(name: string) {
    const code = slugify(name);
    return this.prisma.department.upsert({
      where: { code },
      update: { name },
      create: { name, code },
    });
  }
}

function roleDescription(role: AppRole): string {
  return role === 'administrator'
    ? 'Full administrative access to the training system'
    : 'Access to assigned training courses';
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  );
}

interface UserRow {
  id: string;
  username: string;
  adUsername: string | null;
  authProvider: string;
  email: string | null;
  fullName: string;
  employeeId: string | null;
  jobTitle: string | null;
  department: { name: string } | null;
  role: { name: string };
  approvalStatus: string;
  isActive: boolean;
  lastLoginAt: Date | null;
}

function toSyncedUser(user: UserRow): SyncedUser {
  return {
    id: user.id,
    username: user.username,
    adUsername: user.adUsername,
    authProvider: user.authProvider as AuthProvider,
    email: user.email,
    fullName: user.fullName,
    employeeId: user.employeeId,
    jobTitle: user.jobTitle,
    departmentName: user.department?.name ?? null,
    role: user.role.name as AppRole,
    approvalStatus: user.approvalStatus as ApprovalStatus,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
  };
}
