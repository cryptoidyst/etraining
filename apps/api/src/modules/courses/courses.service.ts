import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CourseDto, CourseQueryDto, CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

const courseInclude = {
  _count: { select: { slides: true } },
} satisfies Prisma.CourseInclude;

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CourseQueryDto): Promise<CourseDto[]> {
    const where: Prisma.CourseWhereInput = {
      AND: [
        query.status ? { status: query.status } : {},
        query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {},
      ],
    };
    const courses = await this.prisma.course.findMany({
      where,
      include: courseInclude,
      orderBy: { createdAt: 'desc' },
    });
    return courses.map(toDto);
  }

  /**
   * Staff-facing catalog: published courses only.
   */
  async listPublished(): Promise<CourseDto[]> {
    const courses = await this.prisma.course.findMany({
      where: { status: 'published' },
      include: courseInclude,
      orderBy: { publishedAt: 'desc' },
    });
    return courses.map(toDto);
  }

  async getById(id: string): Promise<CourseDto> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: courseInclude,
    });
    if (!course) throw new NotFoundException('Course not found.');
    return toDto(course);
  }

  async create(dto: CreateCourseDto, creatorId: string): Promise<CourseDto> {
    const course = await this.prisma.course.create({
      data: {
        title: dto.title.trim(),
        description: dto.description ?? null,
        passingScore: dto.passingScore ?? 80,
        allowRetake: dto.allowRetake ?? true,
        maxAttempts: dto.maxAttempts ?? null,
        createdById: creatorId,
      },
      include: courseInclude,
    });
    return toDto(course);
  }

  async update(id: string, dto: UpdateCourseDto): Promise<CourseDto> {
    await this.assertExists(id);
    const course = await this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        passingScore: dto.passingScore,
        allowRetake: dto.allowRetake,
        maxAttempts: dto.maxAttempts,
      },
      include: courseInclude,
    });
    return toDto(course);
  }

  async remove(id: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!course) throw new NotFoundException('Course not found.');
    if (course.status === 'published') {
      throw new ConflictException('Unpublish the course before deleting it.');
    }
    await this.prisma.course.delete({ where: { id } });
  }

  async publish(id: string): Promise<CourseDto> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { slides: true } } },
    });
    if (!course) throw new NotFoundException('Course not found.');
    if (course._count.slides < 1) {
      throw new ConflictException(
        'A course must contain at least one slide before it can be published.',
      );
    }
    const updated = await this.prisma.course.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: courseInclude,
    });
    return toDto(updated);
  }

  async unpublish(id: string): Promise<CourseDto> {
    await this.assertExists(id);
    const updated = await this.prisma.course.update({
      where: { id },
      data: { status: 'draft', publishedAt: null },
      include: courseInclude,
    });
    return toDto(updated);
  }

  async archive(id: string): Promise<CourseDto> {
    await this.assertExists(id);
    const updated = await this.prisma.course.update({
      where: { id },
      data: { status: 'archived', publishedAt: null },
      include: courseInclude,
    });
    return toDto(updated);
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.course.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Course not found.');
  }
}

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  passingScore: number;
  allowRetake: boolean;
  maxAttempts: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  _count: { slides: number };
}

function toDto(course: CourseRow): CourseDto {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    status: course.status,
    passingScore: course.passingScore,
    allowRetake: course.allowRetake,
    maxAttempts: course.maxAttempts,
    publishedAt: course.publishedAt,
    createdAt: course.createdAt,
    slideCount: course._count.slides,
  };
}
