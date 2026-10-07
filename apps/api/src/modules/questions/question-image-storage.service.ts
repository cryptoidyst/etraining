import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export const QUESTION_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const QUESTION_IMAGE_MAX_SIZE = 5 * 1024 * 1024;

const MAGIC_BYTES: Record<string, (b: Buffer) => boolean> = {
  'image/png': (b) =>
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) =>
    b.subarray(0, 4).toString('latin1') === 'RIFF' &&
    b.subarray(8, 12).toString('latin1') === 'WEBP',
};

@Injectable()
export class QuestionImageStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(
      config.get<string>('storage.slidesDir', './uploads/slides'),
      '../question-images',
    );
    fs.mkdirSync(this.root, { recursive: true });
  }

  assertValid(mimeType: string, size: number): void {
    if (!this.isAllowed(mimeType)) {
      throw new BadRequestException('Question images must be PNG, JPEG, or WebP.');
    }
    if (size > QUESTION_IMAGE_MAX_SIZE) {
      throw new BadRequestException('Image exceeds the 5 MB size limit.');
    }
  }

  isAllowed(mimeType: string): boolean {
    return (QUESTION_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
  }

  verifyMagicBytes(mimeType: string, buffer: Buffer): void {
    const check = MAGIC_BYTES[mimeType];
    if (check && !check(buffer)) {
      throw new BadRequestException('Image content does not match its declared type.');
    }
  }

  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<{ storedPath: string; mimeType: string }> {
    this.verifyMagicBytes(mimeType, buffer);
    const ext = this.safeExtension(originalName);
    const fileName = `${crypto.randomUUID()}${ext}`;
    await fsp.writeFile(path.join(this.root, fileName), buffer);
    return { storedPath: fileName, mimeType };
  }

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
    await fsp.rm(this.resolve(storedPath), { force: true });
  }

  private safeExtension(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '';
  }
}
