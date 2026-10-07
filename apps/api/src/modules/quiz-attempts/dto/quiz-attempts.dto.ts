import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class StartAttemptDto {
  @ApiPropertyOptional({
    example: false,
    description: 'Ignored: start is idempotent per attempt rules',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class SubmittedAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  questionId!: string;

  @ApiProperty({ type: [String], format: 'uuid', maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  selectedOptionIds!: string[];
}

export class SubmitAttemptDto {
  @ApiProperty({ type: [SubmittedAnswerDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmittedAnswerDto)
  answers!: SubmittedAnswerDto[];
}

export class AttemptQuestionDto {
  @ApiProperty({ format: 'uuid' })
  questionId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ nullable: true })
  imagePath!: string | null;

  @ApiProperty({
    type: [Object],
    description: 'Options without the correct-answer flag',
  })
  options!: { optionId: string; text: string }[];
}

export class AttemptDto {
  @ApiProperty({ format: 'uuid' })
  attemptId!: string;

  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty()
  attemptNumber!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [AttemptQuestionDto] })
  questions!: AttemptQuestionDto[];
}

export class AnswerResultDto {
  @ApiProperty({ format: 'uuid' })
  questionId!: string;

  @ApiProperty()
  isCorrect!: boolean;

  @ApiProperty()
  questionText!: string;

  @ApiProperty({ type: [String], example: ['London', 'Berlin'] })
  correctOptionTexts!: string[];

  @ApiProperty({ type: [String], example: ['Paris'] })
  selectedOptionTexts!: string[];
}

export class SubmitResultDto {
  @ApiProperty()
  attemptId!: string;

  @ApiProperty()
  attemptNumber!: number;

  @ApiProperty()
  scorePercent!: number;

  @ApiProperty()
  correctAnswers!: number;

  @ApiProperty()
  totalQuestions!: number;

  @ApiProperty()
  passingScore!: number;

  @ApiProperty()
  passed!: boolean;

  @ApiProperty()
  canRetry!: boolean;

  @ApiProperty()
  attemptsUsed!: number;

  @ApiProperty({ nullable: true })
  attemptsLeft!: number | null;

  @ApiProperty({ type: [AnswerResultDto] })
  results!: AnswerResultDto[];
}

export class AttemptHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  attemptId!: string;

  @ApiProperty()
  attemptNumber!: number;

  @ApiProperty({ nullable: true })
  scorePercent!: number | null;

  @ApiProperty({ nullable: true })
  passed!: boolean | null;

  @ApiProperty()
  status!: string;

  @ApiProperty({ format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ nullable: true, format: 'date-time' })
  submittedAt!: Date | null;
}

export class QuizEligibilityDto {
  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty()
  assigned!: boolean;

  @ApiProperty()
  allSlidesViewed!: boolean;

  @ApiProperty()
  questionCount!: number;

  @ApiProperty({ example: 10 })
  minQuestions!: number;

  @ApiProperty({
    type: [Object],
    description: 'Per-set question counts, e.g. [{ setIndex: 1, count: 12 }]',
  })
  sets!: { setIndex: number; count: number }[];

  @ApiProperty({ description: 'Number of sets that individually have at least 10 questions' })
  validSetCount!: number;

  @ApiProperty({ description: 'At least one set is configured with 10+ questions' })
  quizConfigured!: boolean;

  @ApiProperty({ description: 'Quiz configured (10+ per set) and eligible' })
  quizReady!: boolean;

  @ApiProperty()
  attemptsUsed!: number;

  @ApiProperty({ nullable: true })
  attemptsLeft!: number | null;

  @ApiProperty({ nullable: true })
  bestScore!: number | null;

  @ApiProperty({ nullable: true })
  passed!: boolean | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  resumeAttemptId!: string | null;
}

export class CompletionDto {
  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  completed!: boolean;

  @ApiProperty({ nullable: true })
  bestScore!: number | null;

  @ApiProperty({ nullable: true })
  bestAttemptId!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  completedAt!: Date | null;

  @ApiProperty()
  attemptsUsed!: number;

  @ApiProperty()
  slideCount!: number;

  @ApiProperty()
  slidesViewed!: number;
}

export class UpdateQuizConfigInternalDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxAttempts?: number | null;
}

export class StartReviewDto {
  @IsOptional()
  @IsString()
  note?: string;
}
