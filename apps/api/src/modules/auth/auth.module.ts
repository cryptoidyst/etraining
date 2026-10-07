import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserSyncService } from './user-sync.service';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AD_DIRECTORY } from './ad/ad-directory.interface';
import { LdapService } from './ad/ldap.service';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn', '8h'),
        },
      }),
    }),
  ],
  controllers: [AuthController, UserManagementController],
  providers: [
    AuthService,
    UserSyncService,
    UserManagementService,
    PasswordService,
    JwtStrategy,
    { provide: AD_DIRECTORY, useClass: LdapService },
  ],
  exports: [AuthService],
})
export class AuthModule {}
