import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class DashboardReportDto {
  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  pendingApprovals: number;

  @ApiProperty()
  totalCourses: number;

  @ApiProperty()
  publishedCourses: number;

  @ApiProperty()
  totalAssignments: number;

  @ApiProperty()
  completedAssignments: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  overdueAssignments: number;

  @ApiProperty()
  averageBestScore: number | null;

  @ApiProperty()
  totalAttempts: number;
}

export interface CourseReportRow {
  userId: string;
  fullName: string;
  departmentName: string | null;
  dueDate: Date | null;
  status: 'completed' | 'in_progress' | 'not_started' | 'overdue';
  slidesViewed: number;
  slideCount: number;
  bestScore: number | null;
  attemptsUsed: number;
  passed: boolean;
  completedAt: Date | null;
}

export class CourseReportDto {
  courseId: string;
  courseTitle: string;
  items: CourseReportRow[];
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  averageScore: number | null;
}

export class StaffTranscriptItemDto {
  courseId: string;
  courseTitle: string;
  status: 'completed' | 'in_progress' | 'not_started' | 'overdue';
  slidesViewed: number;
  slideCount: number;
  bestScore: number | null;
  attemptsUsed: number;
  passed: boolean;
  dueDate: Date | null;
  completedAt: Date | null;
  lastAttemptAt: Date | null;
}

export class StaffTranscriptDto {
  userId: string;
  fullName: string;
  departmentName: string | null;
  jobTitle: string | null;
  assignedCourses: number;
  completedCourses: number;
  items: StaffTranscriptItemDto[];
}

export class OverdueItemDto {
  assignmentId: string;
  courseId: string;
  courseTitle: string;
  userId: string;
  fullName: string;
  departmentName: string | null;
  dueDate: Date;
  slidesViewed: number;
  slideCount: number;
  passed: boolean;
  daysOverdue: number;
}

export class ReportQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

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
