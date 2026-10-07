import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SlidesController } from './slides.controller';
import { SlidesService } from './slides.service';
import { SlideStorageService } from './slide-storage.service';
import { MalwareScanService } from './malware-scan.service';
import { PptxConversionService } from './pptx-conversion.service';
import { PdfSplitService } from './pdf-split.service';

@Module({
  imports: [PrismaModule],
  controllers: [SlidesController],
  providers: [
    SlidesService,
    SlideStorageService,
    MalwareScanService,
    PptxConversionService,
    PdfSplitService,
  ],
  exports: [SlidesService],
})
export class SlidesModule {}
