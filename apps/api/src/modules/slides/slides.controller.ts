import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SlidesService } from './slides.service';
import { SLIDE_MAX_FILE_SIZE, SLIDE_MIME_TYPES } from './slide-storage.service';
import { ReorderSlidesDto, SlideDto, UpdateSlideDto } from './dto/slide.dto';

@ApiTags('slides')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class SlidesController {
  constructor(private readonly slidesService: SlidesService) {}

  @Get('courses/:courseId/slides')
  @ApiOperation({ summary: 'List slides of a course, in order' })
  @ApiOkResponse({ type: [SlideDto] })
  list(@Param('courseId', new ParseUUIDPipe()) courseId: string): Promise<SlideDto[]> {
    return this.slidesService.listByCourse(courseId);
  }

  @Post('courses/:courseId/slides')
  @Roles('administrator')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Upload a slide (PDF/PNG/JPEG/WebP, or PPTX which is converted to PDF; max 100 MB). ' +
      'A multi-page PDF is split into one slide per page.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string', maxLength: 200 },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: [SlideDto] })
  upload(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body('title') title?: string,
  ): Promise<SlideDto[]> {
    if (!file) {
      return Promise.reject(new Error('A file is required.'));
    }
    return this.slidesService.upload(courseId, file, title);
  }

  @Patch('slides/:id')
  @Roles('administrator')
  @ApiOperation({ summary: 'Rename a slide' })
  @ApiOkResponse({ type: SlideDto })
  updateTitle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSlideDto,
  ): Promise<SlideDto> {
    return this.slidesService.updateTitle(id, dto.title ?? '');
  }

  @Patch('courses/:courseId/slides/order')
  @Roles('administrator')
  @ApiOperation({ summary: 'Reorder all slides of a course' })
  @ApiOkResponse({ type: [SlideDto] })
  reorder(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: ReorderSlidesDto,
  ): Promise<SlideDto[]> {
    return this.slidesService.reorder(courseId, dto.slideIds);
  }

  @Delete('slides/:id')
  @Roles('administrator')
  @ApiOperation({ summary: 'Delete a slide and its stored file' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.slidesService.remove(id);
  }

  @Get('slides/:id/file')
  @ApiOperation({ summary: 'Stream the slide file (authenticated; owner or admin)' })
  @ApiParam({ name: 'id' })
  async serveFile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mimeType } = await this.slidesService.readFile(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }
}

export { SLIDE_MAX_FILE_SIZE, SLIDE_MIME_TYPES };
