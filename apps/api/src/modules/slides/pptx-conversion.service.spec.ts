import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PptxConversionService } from './pptx-conversion.service';

const execFileAsync = promisify(execFile);

const pptxMime =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function makePptxBytes(): Buffer {
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0x00)]);
}

function serviceWith(sofficePath: string | null): PptxConversionService {
  const config = new ConfigService({ storage: { sofficePath: sofficePath ?? '___missing___' } });
  const service = new PptxConversionService(config);
  (service as unknown as { sofficePath: string | null }).sofficePath = sofficePath;
  return service;
}

describe('PptxConversionService', () => {
  let realSoffice: string | null = null;

  beforeAll(() => {
    const candidates = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
      '/usr/bin/soffice',
      '/usr/local/bin/soffice',
    ];
    realSoffice = candidates.find((c) => fs.existsSync(c)) ?? null;
  });

  it('detects pptx by mime type', () => {
    const service = serviceWith(null);
    expect(service.isPptx(pptxMime)).toBe(true);
    expect(service.isPptx('application/pdf')).toBe(false);
  });

  it('rejects conversion when no converter is configured', async () => {
    const service = serviceWith(null);
    expect(service.available).toBe(false);
    await expect(service.convertToPdf(makePptxBytes(), 'deck.pptx')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('converts a real pptx to pdf when LibreOffice is installed', async () => {
    if (!realSoffice) {
      pending('LibreOffice not installed on this machine');
      return;
    }

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-spec-'));
    try {
      // Build a real one-slide pptx via LibreOffice itself from flat ODF XML.
      const fodp = path.join(workDir, 'spec.fodp');
      fs.writeFileSync(
        fodp,
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ',
          'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ',
          'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ',
          'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" ',
          'office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.presentation">',
          '<office:body><office:presentation><draw:page draw:name="p1">',
          '<draw:frame svg:x="2cm" svg:y="2cm" svg:width="20cm" svg:height="3cm">',
          '<draw:text-box><text:p>Spec slide</text:p></draw:text-box></draw:frame>',
          '</draw:page></office:presentation></office:body></office:document>',
        ].join(''),
        'utf8',
      );
      await execFileAsync(
        realSoffice,
        ['--headless', '--norestore', '--convert-to', 'pptx', '--outdir', workDir, fodp],
        { cwd: workDir, timeout: 120_000, windowsHide: true },
      );
      const pptxBytes = fs.readFileSync(path.join(workDir, 'spec.pptx'));

      const service = serviceWith(realSoffice);
      expect(service.available).toBe(true);
      const result = await service.convertToPdf(pptxBytes, 'spec.pptx');

      expect(result.pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(result.pdfSize).toBe(result.pdf.length);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('rejects a non-convertible file with a clear error', async () => {
    if (!realSoffice) {
      pending('LibreOffice not installed on this machine');
      return;
    }
    const service = serviceWith(realSoffice);
    // Valid ZIP magic (passes upload scan) but not a presentation — soffice fails.
    const notAPresentation = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('this is not a pptx'),
    ]);
    await expect(service.convertToPdf(notAPresentation, 'junk.pptx')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
