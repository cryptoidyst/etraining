import { Test } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserSyncService } from './user-sync.service';
import { PasswordService } from './password.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AD_DIRECTORY, AdDirectory, AdUserRecord } from './ad/ad-directory.interface';

const adUser: AdUserRecord = {
  username: 'jdoe',
  dn: 'CN=John Doe,CN=Users,DC=lab,DC=local',
  fullName: 'John Doe',
  email: 'jdoe@lab.local',
  employeeId: 'E1001',
  department: 'Information Technology',
  jobTitle: 'Engineer',
  groups: ['Training-Staff'],
  enabled: true,
};

const syncedUser = {
  id: 'user-1',
  username: 'jdoe',
  adUsername: 'jdoe',
  authProvider: 'ad' as const,
  email: 'jdoe@lab.local',
  fullName: 'John Doe',
  employeeId: 'E1001',
  jobTitle: 'Engineer',
  departmentName: 'Information Technology',
  role: 'staff' as const,
  approvalStatus: 'approved' as const,
  isActive: true,
  lastLoginAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let directory: jest.Mocked<AdDirectory>;
  let userSync: { syncFromAd: jest.Mock; syncLinkedAdUser: jest.Mock };
  let password: { hash: jest.Mock; verify: jest.Mock };
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    role: { upsert: jest.Mock };
  };

  beforeEach(async () => {
    directory = {
      findUserByUsername: jest.fn(),
      verifyUserCredentials: jest.fn(),
    };
    userSync = { syncFromAd: jest.fn(), syncLinkedAdUser: jest.fn() };
    password = { hash: jest.fn(), verify: jest.fn() };
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      role: { upsert: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AD_DIRECTORY, useValue: directory },
        { provide: UserSyncService, useValue: userSync },
        { provide: PasswordService, useValue: password },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('8h') } },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('falls back to AD when no local credential exists, rejecting unknown users', async () => {
    directory.findUserByUsername.mockResolvedValue(null);
    await expect(service.login({ username: 'ghost', password: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(directory.verifyUserCredentials).not.toHaveBeenCalled();
  });

  it('rejects when the AD password bind fails', async () => {
    directory.findUserByUsername.mockResolvedValue(adUser);
    directory.verifyUserCredentials.mockResolvedValue(false);
    await expect(service.login({ username: 'jdoe', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userSync.syncFromAd).not.toHaveBeenCalled();
  });

  it('issues a token via the AD path on success', async () => {
    directory.findUserByUsername.mockResolvedValue(adUser);
    directory.verifyUserCredentials.mockResolvedValue(true);
    userSync.syncFromAd.mockResolvedValue(syncedUser);

    const result = await service.login({ username: 'jdoe', password: 'correct' });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.role).toBe('staff');
    expect(result.user.adUsername).toBe('jdoe');
  });

  it('authenticates with local credentials without touching AD', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-2',
      username: 'local',
      adUsername: null,
      passwordHash: 'hash',
      approvalStatus: 'approved',
      isActive: true,
      email: null,
      fullName: 'Local User',
      employeeId: null,
      jobTitle: null,
      department: null,
      role: { name: 'staff' },
    });
    password.verify.mockResolvedValue(true);
    prisma.user.update.mockResolvedValue({
      id: 'user-2',
      username: 'local',
      adUsername: null,
      authProvider: 'local',
      passwordHash: 'hash',
      approvalStatus: 'approved',
      isActive: true,
      email: null,
      fullName: 'Local User',
      employeeId: null,
      jobTitle: null,
      department: null,
      role: { name: 'staff' },
      lastLoginAt: new Date(),
    });

    const result = await service.login({ username: 'local', password: 'correct' });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(directory.findUserByUsername).not.toHaveBeenCalled();
  });

  it('blocks a local user whose account is still pending approval', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-3',
      username: 'pending',
      adUsername: null,
      passwordHash: 'hash',
      approvalStatus: 'pending',
      isActive: true,
      email: null,
      fullName: 'Pending User',
      employeeId: null,
      jobTitle: null,
      department: null,
      role: { name: 'staff' },
    });
    password.verify.mockResolvedValue(true);

    await expect(
      service.login({ username: 'pending', password: 'correct' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a pending user on registration', async () => {
    password.hash.mockResolvedValue('hashed');
    prisma.role.upsert.mockResolvedValue({ id: 'role-staff' });
    prisma.user.create.mockResolvedValue({
      id: 'user-4',
      username: 'newbie',
      adUsername: null,
      authProvider: 'local',
      passwordHash: 'hashed',
      approvalStatus: 'pending',
      isActive: true,
      email: null,
      fullName: 'New Bie',
      employeeId: null,
      jobTitle: null,
      department: null,
      role: { name: 'staff' },
      lastLoginAt: null,
    });

    const result = await service.register({
      username: 'newbie',
      fullName: 'New Bie',
      password: 'S3cureP@ss',
    });

    expect(result.user.approvalStatus).toBe('pending');
    expect(prisma.user.create).toHaveBeenCalled();
  });
});
