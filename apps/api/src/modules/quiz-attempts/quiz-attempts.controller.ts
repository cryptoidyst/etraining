import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { QuizAttemptsService } from './quiz-attempts.service';
import {
  AttemptDto,
  AttemptHistoryItemDto,
  CompletionDto,
  QuizEligibilityDto,
  StartAttemptDto,
  SubmitAttemptDto,
  SubmitResultDto,
} from './dto/quiz-attempts.dto';

@ApiTags('quiz-attempts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class QuizAttemptsController {
  constructor(private readonly quizAttemptsService: QuizAttemptsService) {}

  @Get('courses/:courseId/quiz/eligibility')
  @ApiOperation({ summary: 'Quiz eligibility for the current user (gate + retry state)' })
  @ApiOkResponse({ type: QuizEligibilityDto })
  eligibility(
    @Req() req: { user: RequestUser },
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ) {
    return this.quizAttemptsService.getEligibility(req.user.id, courseId);
  }

  @Post('courses/:courseId/quiz/start')
  @ApiOperation({ summary: 'Start (or resume) a quiz attempt' })
  @ApiOkResponse({ type: AttemptDto })
  start(
    @Req() req: { user: RequestUser },
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: StartAttemptDto,
  ) {
    void dto;
    return this.quizAttemptsService.start(req.user.id, courseId);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'Get an in-progress attempt (resume)' })
  @ApiOkResponse({ type: AttemptDto })
  getAttempt(
    @Req() req: { user: RequestUser },
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.quizAttemptsService.getAttempt(req.user.id, attemptId);
  }

  @Post('attempts/:attemptId/submit')
  @ApiOperation({ summary: 'Submit answers; server-side scoring' })
  @ApiOkResponse({ type: SubmitResultDto })
  submit(
    @Req() req: { user: RequestUser },
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.quizAttemptsService.submit(req.user.id, attemptId, dto.answers);
  }

  @Get('courses/:courseId/quiz/history')
  @ApiOperation({ summary: 'Attempt history for the current user' })
  @ApiOkResponse({ type: [AttemptHistoryItemDto] })
  history(
    @Req() req: { user: RequestUser },
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ) {
    return this.quizAttemptsService.getHistory(req.user.id, courseId);
  }

  @Get('courses/:courseId/completion')
  @ApiOperation({ summary: 'Completion status (best attempt + slide progress)' })
  @ApiOkResponse({ type: CompletionDto })
  completion(
    @Req() req: { user: RequestUser },
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ) {
    return this.quizAttemptsService.getCompletion(req.user.id, courseId);
  }
}
