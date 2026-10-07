import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QuestionsService } from './questions.service';
import { QuestionImageStorageService } from './question-image-storage.service';
import {
  CreateQuestionDto,
  QuestionDto,
  QuestionQueryDto,
  UpdateQuestionDto,
  ReorderQuestionsDto,
  BulkCreateQuestionsDto,
  BulkCreateQuestionsResultDto,
} from './dto/question.dto';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrator')
@Controller('courses/:courseId/questions')
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly imageStorage: QuestionImageStorageService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List question templates of a course (filter by type/set, search, paginated)',
  })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'setIndex', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async list(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Query() query: QuestionQueryDto,
  ) {
    const { items, total } = await this.questionsService.list(courseId, query);
    return { items, total };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a question with its options' })
  @ApiOkResponse({ type: QuestionDto })
  getById(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuestionDto> {
    return this.questionsService.getById(courseId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a question (with options) in a course quiz set' })
  @ApiOkResponse({ type: QuestionDto })
  create(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: CreateQuestionDto,
    @Req() req: { user: RequestUser },
  ): Promise<QuestionDto> {
    return this.questionsService.create(courseId, dto, req.user.id);
  }

  @Post('bulk')
  @ApiOperation({
    summary:
      'Bulk-import questions from pasted text into a course set ("1. question / A. option / Answer: A")',
  })
  @ApiOkResponse({ type: BulkCreateQuestionsResultDto })
  createBulk(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Body() dto: BulkCreateQuestionsDto,
    @Req() req: { user: RequestUser },
  ): Promise<BulkCreateQuestionsResultDto> {
    return this.questionsService.createBulk(courseId, dto.text, req.user.id, dto.setIndex ?? 1);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update question text, options and/or move it to another set' })
  @ApiOkResponse({ type: QuestionDto })
  update(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuestionDto,
  ): Promise<QuestionDto> {
    return this.questionsService.update(courseId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a question and its options' })
  async remove(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.questionsService.remove(courseId, id);
  }

  @Put('order/:setIndex')
  @ApiOperation({ summary: 'Replace the question ordering of a set (must list every question)' })
  @ApiOkResponse({ type: [QuestionDto] })
  reorder(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Param('setIndex', new ParseIntPipe()) setIndex: number,
    @Body() dto: ReorderQuestionsDto,
  ): Promise<QuestionDto[]> {
    if (setIndex < 1 || setIndex > 3) {
      throw new BadRequestException('setIndex must be between 1 and 3.');
    }
    return this.questionsService.reorder(courseId, setIndex, dto.questionIds);
  }

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Attach an optional image (PNG/JPEG/WebP, max 5 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  async uploadImage(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<QuestionDto> {
    if (!file) {
      throw new BadRequestException('An image file is required.');
    }
    this.imageStorage.assertValid(file.mimetype, file.size);
    const saved = await this.imageStorage.save(file.buffer, file.originalname, file.mimetype);
    return this.questionsService.setImage(courseId, id, saved);
  }

  @Delete(':id/image')
  @ApiOperation({ summary: 'Remove the question image' })
  @ApiOkResponse({ type: QuestionDto })
  async deleteImage(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<QuestionDto> {
    const question = await this.questionsService.getById(courseId, id);
    if (question.imagePath) {
      await this.imageStorage.delete(question.imagePath);
    }
    return this.questionsService.removeImage(courseId, id);
  }

  @Get(':id/image')
  @ApiOperation({ summary: 'Stream the question image' })
  async serveImage(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const question = await this.questionsService.getById(courseId, id);
    if (!question.imagePath || !question.imageMime) {
      res.status(404).json({ message: 'Question has no image.' });
      return;
    }
    const buffer = await this.imageStorage.read(question.imagePath);
    res.setHeader('Content-Type', question.imageMime);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }
}
