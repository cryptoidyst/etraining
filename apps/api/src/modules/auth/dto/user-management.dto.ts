import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum ApprovalStatusFilter {
  pending = 'pending',
  approved = 'approved',
  rejected = 'rejected',
}

export enum ApprovableRole {
  administrator = 'administrator',
  staff = 'staff',
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ enum: ApprovalStatusFilter })
  @IsOptional()
  @IsEnum(ApprovalStatusFilter)
  status?: ApprovalStatusFilter;
}

export class ApproveUserDto {
  @ApiProperty({ description: 'Department to assign on approval (required)' })
  @IsNotEmpty()
  @IsUUID()
  departmentId!: string;

  @ApiPropertyOptional({ enum: ApprovableRole, description: 'Role to assign on approval' })
  @IsOptional()
  @IsEnum(ApprovableRole)
  role?: ApprovableRole;
}

export class RejectUserDto {
  @ApiPropertyOptional({ example: 'Duplicate account', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ManagedUserDto {
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
  departmentName!: string | null;

  @ApiProperty({ example: 'staff' })
  role!: string;

  @ApiProperty({ example: 'pending', enum: ['pending', 'approved', 'rejected'] })
  approvalStatus!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  lastLoginAt!: Date | null;
}
