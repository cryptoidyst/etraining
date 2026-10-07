import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StaffQueryDto {
  @ApiPropertyOptional({ description: 'Search by username, full name, or email' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by department id' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: ['administrator', 'staff'] })
  @IsOptional()
  @IsIn(['administrator', 'staff'])
  role?: 'administrator' | 'staff';
}

export class StaffDto {
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
  departmentId!: string | null;

  @ApiProperty({ nullable: true })
  departmentName!: string | null;

  @ApiProperty({ example: 'staff' })
  role!: string;

  @ApiProperty({ example: 'approved', enum: ['pending', 'approved', 'rejected'] })
  approvalStatus!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  lastLoginAt!: Date | null;
}
