import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Research and Development' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'rnd', description: 'Unique short code' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'code must be lowercase letters, numbers, and dashes',
  })
  code!: string;

  @ApiPropertyOptional({ example: 'Product research and prototyping' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'R&D' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'Product research and prototyping' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DepartmentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Research and Development' })
  name!: string;

  @ApiProperty({ example: 'rnd' })
  code!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ example: 3 })
  staffCount!: number;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional({ example: 'jane.doe@company.local' })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: 'E1001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeId?: string | null;

  @ApiPropertyOptional({ example: 'Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string | null;

  @ApiPropertyOptional({ example: 'uuid-of-department' })
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
