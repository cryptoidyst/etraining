import { ApiProperty } from '@nestjs/swagger';

export class SlideViewDto {
  @ApiProperty()
  slideId!: string;

  @ApiProperty()
  viewedAt!: Date;
}

export class CourseProgressDto {
  @ApiProperty()
  courseId!: string;

  @ApiProperty({ example: 5 })
  totalSlides!: number;

  @ApiProperty({ example: 3 })
  viewedSlides!: number;

  @ApiProperty({ example: 60 })
  percent!: number;

  @ApiProperty()
  allSlidesViewed!: boolean;

  @ApiProperty({ type: [SlideViewDto] })
  viewed!: SlideViewDto[];
}
