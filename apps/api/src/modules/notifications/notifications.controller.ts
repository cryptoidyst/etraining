import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from './notifications.service';

class ListNotificationsQuery {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  limit?: number;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  list(@Req() req: { user: RequestUser }, @Query() query: ListNotificationsQuery) {
    return this.notificationsService.list(req.user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count' })
  unreadCount(@Req() req: { user: RequestUser }) {
    return this.notificationsService.unreadCount(req.user.id).then((count) => ({ count }));
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Req() req: { user: RequestUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.notificationsService.markRead(req.user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@Req() req: { user: RequestUser }) {
    return this.notificationsService.markAllRead(req.user.id).then(() => ({ ok: true }));
  }
}
