import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsBoolean, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffService } from './staff.service';
import { StaffQueryDto, StaffDto } from './dto/staff.dto';
import { RequestUser } from '../auth/strategies/jwt.strategy';

export class UpdateStaffBodyDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional({ example: 'jane.doe@company.local', nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: 'E1001', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeId?: string | null;

  @ApiPropertyOptional({ example: 'Engineer', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string | null;

  @ApiPropertyOptional({ example: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrator')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'List staff with optional search and filters' })
  @ApiOkResponse({ type: [StaffDto] })
  list(@Query() query: StaffQueryDto): Promise<StaffDto[]> {
    return this.staffService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a staff member by id' })
  @ApiOkResponse({ type: StaffDto })
  getById(@Param('id', new ParseUUIDPipe()) id: string): Promise<StaffDto> {
    return this.staffService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a staff member profile/assignment' })
  @ApiOkResponse({ type: StaffDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStaffBodyDto,
    @Req() req: { user: RequestUser },
  ): Promise<StaffDto> {
    return this.staffService.update(id, req.user.id, dto);
  }
}
