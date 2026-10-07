import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  courseId!: string;

  @ApiProperty({ enum: ['user', 'department'] })
  @IsIn(['user', 'department'])
  targetType!: 'user' | 'department';

  @ApiProperty({ format: 'uuid', description: 'User or department id' })
  @IsUUID('4')
  targetId!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}

export class AssignmentQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  courseId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @ApiPropertyOptional({ example: 'overdue' })
  @IsOptional()
  @IsIn(['overdue'])
  overdue?: string;
}

export class AssignedUsersDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ nullable: true })
  departmentName!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  dueDate!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class MyTrainingItemDto {
  @ApiProperty({ format: 'uuid' })
  assignmentId!: string;

  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty()
  courseTitle!: string;

  @ApiProperty({ nullable: true })
  courseDescription!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  dueDate!: Date | null;

  @ApiProperty({ format: 'date-time' })
  assignedAt!: Date;

  @ApiProperty()
  slideCount!: number;

  @ApiProperty()
  slidesViewed!: number;

  @ApiProperty({ description: 'True when all slides are viewed' })
  allSlidesViewed!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  quizQuestionCount!: number | null;

  @ApiProperty({ type: Boolean, nullable: true })
  quizPassed!: boolean | null;
}

export class BulkAssignResultDto {
  @ApiProperty()
  created!: number;

  @ApiProperty()
  skipped!: number;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class CourseAssignmentsDto {
  @ApiProperty({ type: [AssignedUsersDto] })
  items!: AssignedUsersDto[];

  @ApiProperty()
  total!: number;
}

export class AssignCoursePayloadDto {
  @ApiProperty({ type: [String], format: 'uuid', maxItems: 200 })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds!: string[];
}

export class UpdateAssignmentDto {
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
