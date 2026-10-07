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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, DepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrator')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List departments (admin: all, others: active only)' })
  @ApiQuery({ name: 'includeInactive', required: false, enum: ['true', 'false'] })
  @ApiOkResponse({ type: [DepartmentDto] })
  list(@Query('includeInactive') includeInactive?: string): Promise<DepartmentDto[]> {
    return this.departmentsService.list(includeInactive === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department by id' })
  @ApiOkResponse({ type: DepartmentDto })
  getById(@Param('id', new ParseUUIDPipe()) id: string): Promise<DepartmentDto> {
    return this.departmentsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a department' })
  @ApiCreatedResponse({ type: DepartmentDto })
  create(@Body() dto: CreateDepartmentDto): Promise<DepartmentDto> {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a department' })
  @ApiOkResponse({ type: DepartmentDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentDto> {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a department that has no staff' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.departmentsService.remove(id);
  }
}
