import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ nullable: true })
  adUsername!: string | null;

  @ApiProperty({ example: 'local', enum: ['local', 'ad'] })
  authProvider!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ nullable: true })
  employeeId!: string | null;

  @ApiProperty({ nullable: true })
  jobTitle!: string | null;

  @ApiProperty({ nullable: true })
  departmentName!: string | null;

  @ApiProperty({ example: 'administrator' })
  role!: string;

  @ApiProperty({ example: 'approved', enum: ['pending', 'approved', 'rejected'] })
  approvalStatus!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  lastLoginAt!: Date | null;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  expiresIn!: string;

  @ApiProperty({ type: AuthenticatedUserDto })
  user!: AuthenticatedUserDto;
}

export class RegisterResponseDto {
  @ApiProperty({ type: AuthenticatedUserDto })
  user!: AuthenticatedUserDto;

  @ApiProperty({ example: 'Your account is pending administrator approval.' })
  message!: string;
}
