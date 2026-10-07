import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CoursesService } from './courses.service';
import { CourseDto, CourseQueryDto, CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'List published courses (staff catalog)' })
  @ApiOkResponse({ type: [CourseDto] })
  catalog(): Promise<CourseDto[]> {
    return this.coursesService.listPublished();
  }

  @Get()
  @Roles('administrator')
  @ApiOperation({ summary: 'List all courses with optional status/search filters' })
  @ApiOkResponse({ type: [CourseDto] })
  list(@Query() query: CourseQueryDto): Promise<CourseDto[]> {
    return this.coursesService.list(query);
  }

  @Get(':id')
  @Roles('administrator')
  @ApiOperation({ summary: 'Get a course by id' })
  @ApiOkResponse({ type: CourseDto })
  getById(@Param('id', new ParseUUIDPipe()) id: string): Promise<CourseDto> {
    return this.coursesService.getById(id);
  }

  @Post()
  @Roles('administrator')
  @ApiOperation({ summary: 'Create a draft course' })
  @ApiCreatedResponse({ type: CourseDto })
  create(@Body() dto: CreateCourseDto, @Req() req: { user: RequestUser }): Promise<CourseDto> {
    return this.coursesService.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles('administrator')
  @ApiOperation({ summary: 'Update course details and quiz rules' })
  @ApiOkResponse({ type: CourseDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCourseDto,
  ): Promise<CourseDto> {
    return this.coursesService.update(id, dto);
  }

  @Post(':id/publish')
  @Roles('administrator')
  @ApiOperation({ summary: 'Publish a draft course (requires at least one slide)' })
  @ApiOkResponse({ type: CourseDto })
  publish(@Param('id', new ParseUUIDPipe()) id: string): Promise<CourseDto> {
    return this.coursesService.publish(id);
  }

  @Post(':id/unpublish')
  @Roles('administrator')
  @ApiOperation({ summary: 'Return a published course to draft' })
  @ApiOkResponse({ type: CourseDto })
  unpublish(@Param('id', new ParseUUIDPipe()) id: string): Promise<CourseDto> {
    return this.coursesService.unpublish(id);
  }

  @Post(':id/archive')
  @Roles('administrator')
  @ApiOperation({ summary: 'Archive a course' })
  @ApiOkResponse({ type: CourseDto })
  archive(@Param('id', new ParseUUIDPipe()) id: string): Promise<CourseDto> {
    return this.coursesService.archive(id);
  }

  @Delete(':id')
  @Roles('administrator')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a draft or archived course' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.coursesService.remove(id);
  }
}
