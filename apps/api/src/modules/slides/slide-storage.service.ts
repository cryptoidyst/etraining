import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export const SLIDE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export const SLIDE_PPTX_MIME = SLIDE_MIME_TYPES[4];

export const SLIDE_MAX_FILE_SIZE = 100 * 1024 * 1024;

@Injectable()
export class SlideStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('storage.slidesDir', './uploads/slides'));
    fs.mkdirSync(this.root, { recursive: true });
  }

  assertValid(mimeType: string, size: number): void {
    if (!this.isAllowedMimeType(mimeType)) {
      throw new BadRequestException(
        `Unsupported file type "${mimeType}". Allowed: PDF, PPTX, PNG, JPEG, WebP.`,
      );
    }
    if (size > SLIDE_MAX_FILE_SIZE) {
      throw new BadRequestException(`File exceeds the ${SLIDE_MAX_FILE_SIZE / (1024 * 1024)} MB size limit.`);
    }
  }

  isAllowedMimeType(mimeType: string): boolean {
    return (SLIDE_MIME_TYPES as readonly string[]).includes(mimeType);
  }

  async save(buffer: Buffer, originalName: string, mimeType?: string): Promise<{ storedPath: string }> {
    const ext = this.safeExtension(originalName, mimeType);
    const fileName = `${crypto.randomUUID()}${ext}`;
    const absolute = path.join(this.root, fileName);
    await fsp.writeFile(absolute, buffer);
    return { storedPath: fileName };
  }

  /** Resolve a stored file name to an absolute path, blocking path traversal. */
  resolve(storedPath: string): string {
    const normalized = path.basename(storedPath);
    const absolute = path.join(this.root, normalized);
    if (!absolute.startsWith(this.root)) {
      throw new BadRequestException('Invalid file path.');
    }
    return absolute;
  }

  async read(storedPath: string): Promise<Buffer> {
    return fsp.readFile(this.resolve(storedPath));
  }

  async delete(storedPath: string): Promise<void> {
    const absolute = this.resolve(storedPath);
    await fsp.rm(absolute, { force: true });
  }

  /**
   * Picks a safe extension from the original name. When the stored content is
   * a converted PDF (uploaded as PPTX), the extension follows the mime type.
   */
  private safeExtension(originalName: string, mimeType?: string): string {
    if (mimeType === 'application/pdf') return '.pdf';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/webp') return '.webp';
    const ext = path.extname(originalName).toLowerCase();
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.pptx'];
    return allowed.includes(ext) ? ext : '';
  }
}
