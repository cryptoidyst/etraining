import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/roles/roles.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { CoursesModule } from './modules/courses/courses.module';
import { SlidesModule } from './modules/slides/slides.module';
import { ProgressModule } from './modules/progress/progress.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { QuizConfigModule } from './modules/quiz-config/quiz-config.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { QuizAttemptsModule } from './modules/quiz-attempts/quiz-attempts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { SettingsModule } from './modules/settings/settings.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configuration,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    AuthModule,
    RolesModule,
    DepartmentsModule,
    CoursesModule,
    SlidesModule,
    ProgressModule,
    QuestionsModule,
    QuizConfigModule,
    AssignmentsModule,
    QuizAttemptsModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
