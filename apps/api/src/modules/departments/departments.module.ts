import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [PrismaModule],
  controllers: [DepartmentsController, StaffController],
  providers: [DepartmentsService, StaffService],
})
export class DepartmentsModule {}
