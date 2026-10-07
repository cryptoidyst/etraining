import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';

/**
 * Splits a multi-page PDF into one single-page PDF per page so each page can
 * be stored and tracked as an individual slide. A course deck uploaded as a
 * single PDF would otherwise count as one slide, blocking next/previous
 * navigation and gating the quiz after a single view.
 *
 * If a PDF cannot be parsed we fall back to the original buffer as a single
 * slide rather than rejecting an upload the browser might still render.
 */
@Injectable()
export class PdfSplitService {
  private readonly logger = new Logger(PdfSplitService.name);

  /** Number of pages in a PDF, or 1 when the document cannot be parsed. */
  async pageCount(buffer: Buffer): Promise<number> {
    try {
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      return Math.max(1, doc.getPageCount());
    } catch (error) {
      this.logger.warn(`Could not read PDF page count: ${(error as Error).message}`);
      return 1;
    }
  }

  /**
   * Returns one single-page PDF buffer per page. A single-page PDF (or an
   * unparseable one) is returned as-is.
   */
  async split(buffer: Buffer): Promise<Buffer[]> {
    let source: PDFDocument;
    try {
      source = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (error) {
      this.logger.warn(
        `PDF could not be parsed for splitting; keeping it as a single slide: ${(error as Error).message}`,
      );
      return [buffer];
    }

    const total = source.getPageCount();
    if (total <= 1) return [buffer];

    const pages: Buffer[] = [];
    for (let index = 0; index < total; index++) {
      const page = await PDFDocument.create();
      const [copied] = await page.copyPages(source, [index]);
      page.addPage(copied);
      pages.push(Buffer.from(await page.save()));
    }

    if (pages.length !== total) {
      throw new BadRequestException('Failed to split the PDF into individual slides.');
    }
    return pages;
  }
}
