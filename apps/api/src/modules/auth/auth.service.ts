import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginResponseDto, RegisterResponseDto } from './dto/auth-response.dto';
import { AD_DIRECTORY, AdDirectory } from './ad/ad-directory.interface';
import { PasswordService } from './password.service';
import { SyncedUser, UserSyncService } from './user-sync.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AD_DIRECTORY) private readonly directory: AdDirectory,
    private readonly userSync: UserSyncService,
    private readonly password: PasswordService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Self-registration. The account is created in "pending" state and cannot
   * log in until an administrator approves it. Falls back to the staff role.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const username = dto.username.trim();
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: dto.email ?? undefined }],
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Username or email is already registered.');
    }

    const staffRole = await this.prisma.role.upsert({
      where: { name: 'staff' },
      update: {},
      create: {
        name: 'staff',
        description: 'Access to assigned training courses',
      },
    });

    const user = await this.prisma.user.create({
      data: {
        username,
        fullName: dto.fullName.trim(),
        email: dto.email ?? null,
        passwordHash: await this.password.hash(dto.password),
        authProvider: 'local',
        approvalStatus: 'pending',
        roleId: staffRole.id,
        isActive: true,
      },
      include: { department: true, role: true },
    });

    return {
      user: toPublicUser(toSyncedUser(user)),
      message: 'Your account is pending administrator approval.',
    };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.authenticate(dto.username, dto.password);
    const payload: JwtPayload = {
      sub: user.id,
      username: user.adUsername ?? user.username,
      role: user.role,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.config.get<string>('jwt.expiresIn', '8h'),
      user: toPublicUser(user),
    };
  }

  async getProfile(userId: string): Promise<ReturnType<typeof toPublicUser>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: true, role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Your session is no longer valid.');
    }
    return toPublicUser(toSyncedUser(user));
  }

  /**
   * Local credentials are tried first. When no local password is on record the
   * username is validated against Active Directory (SSO fallback).
   */
  private async authenticate(rawUsername: string, password: string): Promise<SyncedUser> {
    const localUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: rawUsername }, { adUsername: rawUsername }],
      },
      include: { department: true, role: true },
    });

    if (localUser?.passwordHash) {
      return this.authenticateLocal(localUser, password);
    }

    return this.authenticateAgainstAd(rawUsername, password, localUser?.id ?? null);
  }

  private async authenticateLocal(
    user: {
      id: string;
      username: string;
      adUsername: string | null;
      passwordHash: string | null;
      approvalStatus: string;
      isActive: boolean;
      email: string | null;
      fullName: string;
      employeeId: string | null;
      jobTitle: string | null;
      department: { name: string } | null;
      role: { name: string };
    },
    password: string,
  ): Promise<SyncedUser> {
    const valid = await this.password.verify(user.passwordHash ?? '', password);
    if (!valid) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    this.assertAccountUsable(user.approvalStatus, user.isActive);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { department: true, role: true },
    });
    return toSyncedUser(updated);
  }

  private async authenticateAgainstAd(
    rawUsername: string,
    password: string,
    existingUserId: string | null,
  ): Promise<SyncedUser> {
    const adUser = await this.directory.findUserByUsername(rawUsername);
    if (!adUser) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const valid = await this.directory.verifyUserCredentials(adUser.dn, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    if (existingUserId) {
      return this.userSync.syncLinkedAdUser(existingUserId, adUser);
    }
    return this.userSync.syncFromAd(adUser);
  }

  private assertAccountUsable(approvalStatus: string, isActive: boolean): void {
    if (!isActive) {
      throw new ForbiddenException('Your account is disabled.');
    }
    if (approvalStatus === 'pending') {
      throw new ForbiddenException('Your account is pending administrator approval.');
    }
    if (approvalStatus === 'rejected') {
      throw new ForbiddenException('Your registration was rejected.');
    }
  }
}

interface UserRow {
  id: string;
  username: string;
  adUsername: string | null;
  authProvider?: string;
  fullName: string;
  email: string | null;
  employeeId: string | null;
  jobTitle: string | null;
  approvalStatus: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  department: { name: string } | null;
  role: { name: string };
}

function toSyncedUser(user: UserRow): SyncedUser {
  return {
    id: user.id,
    username: user.username,
    adUsername: user.adUsername,
    authProvider: (user.authProvider as SyncedUser['authProvider']) ?? 'local',
    email: user.email,
    fullName: user.fullName,
    employeeId: user.employeeId,
    jobTitle: user.jobTitle,
    departmentName: user.department?.name ?? null,
    role: user.role.name as SyncedUser['role'],
    approvalStatus: user.approvalStatus as SyncedUser['approvalStatus'],
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
  };
}

function toPublicUser(user: SyncedUser) {
  return {
    id: user.id,
    username: user.username,
    adUsername: user.adUsername,
    authProvider: user.authProvider,
    email: user.email,
    fullName: user.fullName,
    employeeId: user.employeeId,
    jobTitle: user.jobTitle,
    departmentName: user.departmentName,
    role: user.role,
    approvalStatus: user.approvalStatus,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
  };
}
