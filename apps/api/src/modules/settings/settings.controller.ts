import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { SettingsService } from './settings.service';

class UpdateSettingsDto {
  @IsObject()
  values!: Record<string, string>;
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @ApiOperation({ summary: 'Get all system settings (admin)' })
  getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @ApiOperation({ summary: 'Update system settings (admin)' })
  update(@Req() req: { user: RequestUser }, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto.values, req.user.id);
  }
}
