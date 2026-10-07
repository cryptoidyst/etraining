import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const QUESTION_TYPES = ['multiple_choice', 'true_false'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export class QuestionOptionInputDto {
  @ApiProperty({ example: 'Paris' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateQuestionDto {
  @ApiProperty({ enum: QUESTION_TYPES, example: 'multiple_choice' })
  @IsIn(QUESTION_TYPES)
  type!: QuestionType;

  @ApiProperty({ example: 'What is the capital of France?' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  text!: string;

  @ApiProperty({
    type: [QuestionOptionInputDto],
    description:
      '2–6 options. Multiple choice: exactly one correct. True/false: ignored, auto-created.',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  options!: QuestionOptionInputDto[];

  @ApiPropertyOptional({
    description: 'Quiz set of the course this question belongs to (1–3).',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  setIndex?: number;
}

export class UpdateQuestionDto {
  @ApiPropertyOptional({ example: 'Updated question text' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  text?: string;

  @ApiPropertyOptional({ type: [QuestionOptionInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  options?: QuestionOptionInputDto[];

  @ApiPropertyOptional({ description: 'Move the question to another quiz set (1–3).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  setIndex?: number;
}

export class ReorderQuestionsDto {
  @ApiProperty({
    type: [String],
    description: 'Every question id of the set, in the desired order.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds!: string[];
}

export class QuestionOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty()
  isCorrect!: boolean;

  @ApiProperty()
  orderIndex!: number;
}

export class QuestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  setIndex!: number;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty({ enum: QUESTION_TYPES })
  type!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ nullable: true })
  imagePath!: string | null;

  @ApiProperty({ nullable: true })
  imageMime!: string | null;

  @ApiProperty({ type: [QuestionOptionDto] })
  options!: QuestionOptionDto[];

  @ApiProperty()
  createdAt!: Date;
}

export class BulkCreateQuestionsDto {
  @ApiProperty({
    description:
      'Raw pasted text. Each question starts with "1." / "2.", options are "A." "B." etc., ' +
      'and the correct option is marked with a line "Answer: B". Separate questions with a blank line.',
    example:
      '1. What is the capital of France?\nA. London\nB. Paris\nC. Berlin\nD. Madrid\nAnswer: B',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  text!: string;

  @ApiPropertyOptional({ description: 'Quiz set to import into (1–3).', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  setIndex?: number;
}

export class BulkCreateQuestionsResultDto {
  @ApiProperty({ example: 12 })
  created!: number;

  @ApiProperty({ example: 0 })
  failed!: number;

  @ApiProperty({ type: [String], example: [] })
  errors!: string[];
}

export class QuestionQueryDto {
  @ApiPropertyOptional({ enum: QUESTION_TYPES })
  @IsOptional()
  @IsIn(QUESTION_TYPES)
  type?: QuestionType;

  @ApiPropertyOptional({ description: 'Search question text' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by quiz set (1–3)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  setIndex?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}
