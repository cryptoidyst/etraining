import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QuizConfigService } from './quiz-config.service';
import {
  AttachedQuestionDto,
  QuizConfigDto,
  UpdateQuizConfigDto,
} from './dto/quiz-config.dto';

@ApiTags('quiz-config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrator')
@Controller('courses/:courseId/quiz')
export class QuizConfigController {
  constructor(private readonly quizConfigService: QuizConfigService) {}

  @Get('questions')
  @ApiOperation({ summary: 'List question templates of the course quiz, in order' })
  @ApiOkResponse({ type: [AttachedQuestionDto] })
  listAttached(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Query('setIndex') setIndex?: string,
  ): Promise<AttachedQuestionDto[]> {
    return this.quizConfigService.getAttached(
      courseId,
      setIndex ? Number.parseInt(setIndex, 10) : undefined,
    );
  }

  @Get('config')
  @ApiOperation({ summary: 'Get quiz config + validity (10-20 rule)' })
  @ApiOkResponse({ type: QuizConfigDto })
  getConfig(@Param('courseId', new ParseUUIDPipe()) courseId: string): Promise<QuizConfigDto> {
    return this.quizConfigService.getConfig(courseId);
  }

  @Patch('config')
  @ApiOperation({ summary: 'Update passing score / retry policy' })
  @ApiOkResponse({ type: QuizConfigDto })
  updateConfig(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: UpdateQuizConfigDto,
  ): Promise<QuizConfigDto> {
    return this.quizConfigService.updateConfig(courseId, dto);
  }
}
