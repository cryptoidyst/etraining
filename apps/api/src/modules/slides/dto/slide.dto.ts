import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SlideDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 245760 })
  fileSize!: number;

  @ApiProperty({ example: 0 })
  orderIndex!: number;

  @ApiProperty()
  createdAt!: Date;
}

export class ReorderSlidesDto {
  @ApiProperty({ type: [String], description: 'Slide ids in the new order' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  slideIds!: string[];
}

export class UpdateSlideDto {
  @ApiPropertyOptional({ example: 'Introduction' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;
}
