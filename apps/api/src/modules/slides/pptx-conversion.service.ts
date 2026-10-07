import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { SLIDE_PPTX_MIME } from './slide-storage.service';

const execFileAsync = promisify(execFile);

const PPTX_TO_PDF_TIMEOUT_MS = 120_000;

const SOFFICE_CANDIDATES = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.com',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  '/opt/libreoffice/program/soffice',
];

export interface ConversionResult {
  pdf: Buffer;
  pdfSize: number;
}

/**
 * Converts uploaded PPTX presentations to PDF using LibreOffice headless
 * (`soffice --headless --convert-to pdf`). The stored/served file is the
 * PDF, so the viewer, progress tracking and quiz gating work unchanged.
 */
@Injectable()
export class PptxConversionService {
  private readonly logger = new Logger(PptxConversionService.name);
  private readonly sofficePath: string | null;

  constructor(config: ConfigService) {
    this.sofficePath = this.resolveSoffice(config.get<string>('storage.sofficePath'));
    if (this.sofficePath) {
      this.logger.log(`PPTX → PDF conversion available via ${this.sofficePath}`);
    } else {
      this.logger.warn(
        'LibreOffice not found — PPTX uploads will be rejected. Install LibreOffice or set SOFFICE_PATH.',
      );
    }
  }

  get available(): boolean {
    return this.sofficePath !== null;
  }

  isPptx(mimeType: string): boolean {
    return mimeType === SLIDE_PPTX_MIME;
  }

  /**
   * Converts a PPTX buffer to a PDF buffer. Verifies the output really is a
   * PDF before returning it; every temp artifact is cleaned up.
   */
  async convertToPdf(buffer: Buffer, originalName: string): Promise<ConversionResult> {
    if (!this.sofficePath) {
      throw new ServiceUnavailableException(
        'PPTX upload is not available: the server has no LibreOffice converter installed.',
      );
    }

    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pptx-convert-'));
    try {
      const inputName = 'input.pptx';
      await fsp.writeFile(path.join(workDir, inputName), buffer);

      try {
        await execFileAsync(
          this.sofficePath,
          ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', workDir, inputName],
          { cwd: workDir, timeout: PPTX_TO_PDF_TIMEOUT_MS, windowsHide: true },
        );
      } catch (error) {
        this.logger.warn(
          `soffice failed for "${originalName}": ${(error as Error).message.split('\n')[0]}`,
        );
        throw new BadRequestException(
          'Could not convert the PPTX file to PDF. The file may be corrupted or password-protected.',
        );
      }

      const pdfPath = path.join(workDir, 'input.pdf');
      let pdf: Buffer;
      try {
        pdf = await fsp.readFile(pdfPath);
      } catch {
        throw new BadRequestException(
          'Could not convert the PPTX file to PDF. The file may be corrupted or password-protected.',
        );
      }

      if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw new BadRequestException('Converted file is not a valid PDF. Upload rejected.');
      }

      this.logger.log(`Converted "${originalName}" (${buffer.length} B) to PDF (${pdf.length} B)`);
      return { pdf, pdfSize: pdf.length };
    } finally {
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private resolveSoffice(configured: string | undefined): string | null {
    const candidates = [
      configured ?? '',
      ...SOFFICE_CANDIDATES,
    ].filter((p): p is string => Boolean(p));

    for (const candidate of candidates) {
      try {
        fs.accessSync(candidate);
        return candidate;
      } catch {
        // try next candidate
      }
    }
    return null;
  }
}
