import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuizConfigController } from './quiz-config.controller';
import { QuizConfigService } from './quiz-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [QuizConfigController],
  providers: [QuizConfigService],
  exports: [QuizConfigService],
})
export class QuizConfigModule {}
