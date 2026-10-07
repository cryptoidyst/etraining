import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { AssignmentsService } from './assignments.service';
import {
  AssignmentQueryDto,
  BulkAssignResultDto,
  CreateAssignmentDto,
  MyTrainingItemDto,
  PaginationQueryDto,
  UpdateAssignmentDto,
} from './dto/assignments.dto';

@ApiTags('assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post('assignments')
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @ApiOperation({ summary: 'Assign a course to a user or department (materialized per user)' })
  @ApiOkResponse({ type: BulkAssignResultDto })
  create(@Req() req: { user: RequestUser }, @Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(req.user.id, dto);
  }

  @Get('assignments')
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @ApiOperation({ summary: 'List assignments (admin, filters)' })
  list(@Query() query: AssignmentQueryDto) {
    return this.assignmentsService.list(query);
  }

  @Get('courses/:courseId/assignments')
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @ApiOperation({ summary: 'List assigned users for a course (paginated)' })
  listForCourse(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.assignmentsService.listForCourse(courseId, pagination);
  }

  @Patch('assignments/:id')
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @ApiOperation({ summary: 'Update assignment due date' })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateAssignmentDto) {
    return this.assignmentsService.updateDueDate(id, dto.dueDate);
  }

  @Delete('assignments/:id')
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @ApiOperation({ summary: 'Remove an assignment' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.assignmentsService.remove(id);
  }

  @Get('my-training')
  @ApiOperation({ summary: 'Current user assigned courses with progress' })
  @ApiOkResponse({ type: [MyTrainingItemDto] })
  myTraining(@Req() req: { user: RequestUser }) {
    return this.assignmentsService.myTraining(req.user.id);
  }
}
