import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'manager' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9-]*$/, {
    message: 'name must be lowercase letters, numbers, and dashes',
  })
  name!: string;

  @ApiPropertyOptional({ example: 'Manages assigned departments' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['courses.read'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissionCodes?: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Manager of departments' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['courses.read', 'quiz.take'] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class RoleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'administrator' })
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ example: true })
  isSystem!: boolean;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class PermissionDto {
  @ApiProperty({ example: 'courses.read' })
  code!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;
}

export class SetRoleSystemFlagDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isSystem!: boolean;
}
