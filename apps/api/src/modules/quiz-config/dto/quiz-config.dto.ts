import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export const QUIZ_MIN_QUESTIONS = 10;

export class UpdateQuizConfigDto {
  @ApiPropertyOptional({ example: 80, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @ApiPropertyOptional({ example: 3, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxAttempts?: number | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;
}

export class AttachedQuestionDto {
  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty({ example: 1 })
  setIndex!: number;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ nullable: true })
  imagePath!: string | null;

  @ApiProperty({ type: [String] })
  optionTexts!: string[];
}

export class QuizConfigDto {
  @ApiProperty()
  courseId!: string;

  @ApiProperty({ example: 10 })
  questionCount!: number;

  @ApiProperty({ example: 10 })
  minQuestions!: number;

  @ApiProperty({
    type: [Object],
    description: 'Per-set counts, e.g. [{ setIndex: 1, count: 12 }]',
  })
  sets!: { setIndex: number; count: number }[];

  @ApiProperty()
  shuffleQuestions!: boolean;

  @ApiProperty()
  shuffleOptions!: boolean;

  @ApiProperty({ example: 80 })
  passingScore!: number;

  @ApiProperty()
  allowRetake!: boolean;

  @ApiProperty({ nullable: true })
  maxAttempts!: number | null;

  @ApiProperty({ example: false, description: 'True when at least one set has 10+ questions' })
  isValid!: boolean;
}
