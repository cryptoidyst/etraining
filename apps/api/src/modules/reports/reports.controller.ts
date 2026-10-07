import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import {
  CourseReportDto,
  DashboardReportDto,
  OverdueItemDto,
  ReportQueryDto,
  StaffTranscriptDto,
} from './dto/reports.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrator')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Aggregate KPIs for the admin dashboard' })
  @ApiOkResponse({ type: DashboardReportDto })
  dashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('courses/:courseId')
  @ApiOperation({ summary: 'Per-course completion report (assigned users, best attempt)' })
  @ApiOkResponse({ type: CourseReportDto })
  courseReport(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getCourseReport(courseId, query);
  }

  @Get('staff/:userId')
  @ApiOperation({ summary: 'Training transcript for one staff member' })
  @ApiOkResponse({ type: StaffTranscriptDto })
  staffTranscript(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.reportsService.getStaffTranscript(userId);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Overdue assignments (not yet passed)' })
  @ApiOkResponse({ type: [OverdueItemDto] })
  overdue(@Query() query: ReportQueryDto) {
    return this.reportsService.getOverdue(query);
  }
}
