/**
 * One-off backfill: re-splits slide rows whose stored file is a multi-page PDF
 * into one slide row per page, matching the new upload behaviour.
 *
 * Multi-page PDFs were previously stored as a single slide, so the viewer could
 * not page through them and the quiz gate counted the whole deck as one slide.
 *
 * Usage (from apps/api):
 *   npx ts-node --transpile-only prisma/backfill-split-slides.ts          # dry run
 *   npx ts-node --transpile-only prisma/backfill-split-slides.ts --apply  # write changes
 *
 * The script is idempotent: a course whose slides are all single-page PDFs is
 * left untouched. Viewing progress on a re-split slide is reset because the
 * old slide row is replaced (slide_progress cascades on delete).
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const slidesDir = path.resolve(
  process.env.SLIDES_DIR ?? './uploads/slides',
);

async function pageCount(absolute: string): Promise<number> {
  const bytes = await fs.promises.readFile(absolute);
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return Math.max(1, doc.getPageCount());
  } catch {
    return 1;
  }
}

async function splitToFiles(absolute: string): Promise<string[]> {
  const bytes = await fs.promises.readFile(absolute);
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = source.getPageCount();
  const written: string[] = [];
  for (let index = 0; index < total; index++) {
    const page = await PDFDocument.create();
    const [copied] = await page.copyPages(source, [index]);
    page.addPage(copied);
    const out = `${crypto.randomUUID()}.pdf`;
    await fs.promises.writeFile(path.join(slidesDir, out), Buffer.from(await page.save()));
    written.push(out);
  }
  return written;
}

async function main(): Promise<void> {
  const slides = await prisma.slide.findMany({
    where: { mimeType: 'application/pdf' },
    orderBy: [{ courseId: 'asc' }, { orderIndex: 'asc' }],
  });

  const byCourse = new Map<string, typeof slides>();
  for (const slide of slides) {
    const list = byCourse.get(slide.courseId) ?? [];
    list.push(slide);
    byCourse.set(slide.courseId, list);
  }

  let coursesChanged = 0;
  for (const [courseId, courseSlides] of byCourse) {
    const counts = new Map<string, number>();
    for (const slide of courseSlides) {
      counts.set(slide.id, await pageCount(path.join(slidesDir, path.basename(slide.filePath))));
    }
    if (![...counts.values()].some((c) => c > 1)) continue;
    coursesChanged++;

    console.log(`\nCourse ${courseId}`);
    for (const slide of courseSlides) {
      const n = counts.get(slide.id) ?? 1;
      console.log(`  ${n > 1 ? 'SPLIT ' : 'keep  '} ${slide.title} (${n} page${n === 1 ? '' : 's'})`);
    }

    if (!apply) continue;

    const ordered = await prisma.slide.findMany({
      where: { courseId },
      orderBy: { orderIndex: 'asc' },
    });

    const flat: { courseId: string; title: string; filePath: string; mimeType: string; fileSize: number }[] = [];
    const toDelete: string[] = [];

    for (const slide of ordered) {
      const n = counts.get(slide.id) ?? 1;
      if (n <= 1) {
        flat.push({
          courseId: slide.courseId,
          title: slide.title,
          filePath: slide.filePath,
          mimeType: slide.mimeType,
          fileSize: slide.fileSize,
        });
        continue;
      }
      const base = slide.title.replace(/\s*\(\d+\/\d+\)$/, '');
      const absolute = path.join(slidesDir, path.basename(slide.filePath));
      const written = await splitToFiles(absolute);
      written.forEach((filePath, i) => {
        const size = fs.statSync(path.join(slidesDir, filePath)).size;
        flat.push({
          courseId: slide.courseId,
          title: `${base} (${i + 1}/${written.length})`.slice(0, 200),
          filePath,
          mimeType: 'application/pdf',
          fileSize: size,
        });
      });
      toDelete.push(slide.filePath);
    }

    await prisma.$transaction(async (tx) => {
      await tx.slide.deleteMany({ where: { courseId } });
      for (let i = 0; i < flat.length; i++) {
        await tx.slide.create({ data: { ...flat[i], orderIndex: i } });
      }
    });

    for (const filePath of toDelete) {
      const absolute = path.join(slidesDir, path.basename(filePath));
      await fs.promises.rm(absolute, { force: true });
    }
    console.log(`  → wrote ${flat.length} slides for course ${courseId}`);
  }

  if (coursesChanged === 0) {
    console.log('No multi-page PDF slides found. Nothing to do.');
  } else if (!apply) {
    console.log(`\nDry run: ${coursesChanged} course(s) would change. Re-run with --apply.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
