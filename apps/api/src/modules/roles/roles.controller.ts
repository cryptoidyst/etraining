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
  Put,
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
import { RolesService } from './roles.service';
import { CreateRoleDto, PermissionDto, RoleDto, UpdateRoleDto } from './dto/role.dto';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrator')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles with their permissions' })
  @ApiOkResponse({ type: [RoleDto] })
  list(): Promise<RoleDto[]> {
    return this.rolesService.list();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all available permission codes' })
  @ApiOkResponse({ type: [PermissionDto] })
  listPermissions(): Promise<PermissionDto[]> {
    return this.rolesService.listPermissions();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a role by id' })
  @ApiOkResponse({ type: RoleDto })
  getById(@Param('id', new ParseUUIDPipe()) id: string): Promise<RoleDto> {
    return this.rolesService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a role, optionally with permissions' })
  @ApiCreatedResponse({ type: RoleDto })
  create(@Body() dto: CreateRoleDto): Promise<RoleDto> {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role description and/or permissions' })
  @ApiOkResponse({ type: RoleDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleDto> {
    return this.rolesService.update(id, dto);
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'Replace the permission set of a role' })
  @ApiOkResponse({ type: RoleDto })
  setPermissions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleDto> {
    return this.rolesService.update(id, {
      permissionCodes: dto.permissionCodes ?? [],
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a non-system, unassigned role' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.rolesService.remove(id);
  }
}
