import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProgressService } from './progress.service';
import { CourseProgressDto } from './dto/progress.dto';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('courses/:courseId/progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('slides/:slideId/view')
  @ApiOperation({ summary: 'Mark a slide as viewed (idempotent)' })
  async markViewed(
    @Req() req: { user: RequestUser },
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Param('slideId', new ParseUUIDPipe()) slideId: string,
  ): Promise<void> {
    await this.progressService.recordSlideView(req.user.id, courseId, slideId);
  }

  @Get()
  @ApiOperation({ summary: 'Get my reading progress for a course (includes quiz gate)' })
  @ApiOkResponse({ type: CourseProgressDto })
  getProgress(
    @Req() req: { user: RequestUser },
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ): Promise<CourseProgressDto> {
    return this.progressService.getCourseProgress(req.user.id, courseId);
  }
}
