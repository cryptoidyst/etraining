import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SlideStorageService } from './slide-storage.service';
import { MalwareScanService } from './malware-scan.service';
import { PptxConversionService } from './pptx-conversion.service';
import { PdfSplitService } from './pdf-split.service';
import { SlideDto } from './dto/slide.dto';

@Injectable()
export class SlidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SlideStorageService,
    private readonly malwareScan: MalwareScanService,
    private readonly pptxConversion: PptxConversionService,
    private readonly pdfSplit: PdfSplitService,
  ) {}

  async listByCourse(courseId: string): Promise<SlideDto[]> {
    await this.assertCourseExists(courseId);
    const slides = await this.prisma.slide.findMany({
      where: { courseId },
      orderBy: { orderIndex: 'asc' },
    });
    return slides.map(toDto);
  }

  /**
   * Stores an uploaded slide. A multi-page PDF is split into one slide per
   * page so each page is viewed, ordered and tracked individually. Returns
   * the created slides in upload order.
   */
  async upload(
    courseId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    title?: string,
  ): Promise<SlideDto[]> {
    await this.assertCourseExists(courseId);
    this.storage.assertValid(file.mimetype, file.size);
    this.malwareScan.scan(file.originalname, file.mimetype, file.buffer);

    const baseTitle = (title?.trim() || stripExtension(file.originalname)).slice(0, 200);

    let storedBuffer = file.buffer;
    let mimeType = file.mimetype;
    if (this.pptxConversion.isPptx(file.mimetype)) {
      const converted = await this.pptxConversion.convertToPdf(file.buffer, file.originalname);
      storedBuffer = converted.pdf;
      mimeType = 'application/pdf';
    }

    const parts =
      mimeType === 'application/pdf'
        ? await this.pdfSplit.split(storedBuffer)
        : [storedBuffer];

    const last = await this.prisma.slide.aggregate({
      where: { courseId },
      _max: { orderIndex: true },
    });
    const startIndex = (last._max.orderIndex ?? -1) + 1;

    // Store every page first, then insert the rows in one transaction so a
    // failure can never leave a half-uploaded deck (files or rows) behind.
    const storedPaths: string[] = [];
    try {
      const rows: {
        courseId: string;
        title: string;
        filePath: string;
        mimeType: string;
        fileSize: number;
        orderIndex: number;
      }[] = [];

      for (let page = 0; page < parts.length; page++) {
        const buffer = parts[page];
        const { storedPath } = await this.storage.save(buffer, file.originalname, mimeType);
        storedPaths.push(storedPath);
        const slideTitle =
          parts.length > 1 ? `${baseTitle} (${page + 1}/${parts.length})` : baseTitle;
        rows.push({
          courseId,
          title: slideTitle.slice(0, 200),
          filePath: storedPath,
          mimeType,
          fileSize: buffer.length,
          orderIndex: startIndex + page,
        });
      }

      const created = await this.prisma.$transaction(
        rows.map((data) => this.prisma.slide.create({ data })),
      );
      return created.map(toDto);
    } catch (error) {
      await Promise.all(storedPaths.map((p) => this.storage.delete(p).catch(() => undefined)));
      throw error;
    }
  }

  async updateTitle(slideId: string, title: string): Promise<SlideDto> {
    await this.assertExists(slideId);
    const slide = await this.prisma.slide.update({
      where: { id: slideId },
      data: { title: title.trim().slice(0, 200) },
    });
    return toDto(slide);
  }

  /**
   * Applies a new ordering. All ids must belong to the same course and be complete.
   */
  async reorder(courseId: string, slideIds: string[]): Promise<SlideDto[]> {
    const slides = await this.prisma.slide.findMany({
      where: { courseId },
      select: { id: true },
    });
    const existing = new Set(slides.map((s) => s.id));
    const unique = new Set(slideIds);

    if (unique.size !== slideIds.length) {
      throw new BadRequestException('Duplicate slide ids in reorder payload.');
    }
    if (slideIds.some((id) => !existing.has(id))) {
      throw new BadRequestException('Reorder payload references slides outside this course.');
    }
    if (slideIds.length !== slides.length) {
      throw new BadRequestException('Reorder payload must include every slide of the course.');
    }

    await this.prisma.$transaction(
      slideIds.map((id, index) =>
        this.prisma.slide.update({
          where: { id },
          data: { orderIndex: index },
        }),
      ),
    );

    return this.listByCourse(courseId);
  }

  async remove(slideId: string): Promise<void> {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      select: { id: true, filePath: true },
    });
    if (!slide) throw new NotFoundException('Slide not found.');
    await this.prisma.slide.delete({ where: { id: slideId } });
    await this.storage.delete(slide.filePath);
  }

  async readFile(slideId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const slide = await this.prisma.slide.findUnique({
      where: { id: slideId },
      select: { filePath: true, mimeType: true },
    });
    if (!slide) throw new NotFoundException('Slide not found.');
    const buffer = await this.storage.read(slide.filePath);
    return {
      buffer,
      mimeType: slide.mimeType,
      fileName: slide.filePath,
    };
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const exists = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Course not found.');
  }

  private async assertExists(slideId: string): Promise<void> {
    const exists = await this.prisma.slide.findUnique({
      where: { id: slideId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Slide not found.');
  }
}

interface SlideRow {
  id: string;
  courseId: string;
  title: string;
  mimeType: string;
  fileSize: number;
  orderIndex: number;
  createdAt: Date;
}

function toDto(slide: SlideRow): SlideDto {
  return {
    id: slide.id,
    courseId: slide.courseId,
    title: slide.title,
    mimeType: slide.mimeType,
    fileSize: slide.fileSize,
    orderIndex: slide.orderIndex,
    createdAt: slide.createdAt,
  };
}

function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}
