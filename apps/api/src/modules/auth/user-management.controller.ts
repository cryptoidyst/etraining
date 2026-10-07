import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserManagementService } from './user-management.service';
import {
  ListUsersQueryDto,
  ManagedUserDto,
  ApproveUserDto,
  RejectUserDto,
} from './dto/user-management.dto';
import { RequestUser } from './strategies/jwt.strategy';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrator')
@Controller('users')
export class UserManagementController {
  constructor(private readonly users: UserManagementService) {}

  @Get()
  @ApiOperation({ summary: 'List users, optionally filtered by approval status' })
  @ApiOkResponse({ type: [ManagedUserDto] })
  list(@Query() query: ListUsersQueryDto): Promise<ManagedUserDto[]> {
    return this.users.list(query.status);
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a pending registration, optionally assigning department and role',
  })
  @ApiOkResponse({ type: ManagedUserDto })
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveUserDto,
    @Req() req: { user: RequestUser },
  ): Promise<ManagedUserDto> {
    return this.users.approve(id, req.user.id, {
      departmentId: dto.departmentId,
      role: dto.role,
    });
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending registration' })
  @ApiOkResponse({ type: ManagedUserDto })
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectUserDto,
    @Req() req: { user: RequestUser },
  ): Promise<ManagedUserDto> {
    return this.users.reject(id, req.user.id, dto.reason);
  }
}
