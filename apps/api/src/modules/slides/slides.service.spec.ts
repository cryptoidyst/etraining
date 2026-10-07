import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SlidesService } from './slides.service';
import { SlideStorageService } from './slide-storage.service';
import { MalwareScanService } from './malware-scan.service';
import { PptxConversionService } from './pptx-conversion.service';
import { PdfSplitService } from './pdf-split.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SlidesService', () => {
  let service: SlidesService;
  let storage: SlideStorageService;
  let prisma: {
    course: { findUnique: jest.Mock };
    slide: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      aggregate: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tmpDir: string;

  const file = (overrides: Record<string, unknown> = {}) => ({
    originalname: 'intro.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('%PDF-1.4 fake-pdf'),
    ...overrides,
  });

  const realPptx = () => Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.alloc(100, 0x20),
  ]);

  const fakePdf = () => Buffer.from('%PDF-1.4 converted-output');

  /** PdfSplitService stub: by default keeps a PDF as a single slide. */
  const pdfSplit = (parts: Buffer[] | ((buffer: Buffer) => Promise<Buffer[]>)) => {
    const svc = new PdfSplitService();
    jest
      .spyOn(svc, 'split')
      .mockImplementation(async (buffer: Buffer) =>
        typeof parts === 'function' ? parts(buffer) : parts,
      );
    return svc;
  };

  const conversion = (pdf: Buffer | null = fakePdf()) => {
    const conv = new PptxConversionService(
      new ConfigService({ storage: { sofficePath: 'C:\\soffice\\soffice.com' } }),
    );
    (conv as unknown as { sofficePath: string | null }).sofficePath = 'C:\\soffice\\soffice.com';
    jest.spyOn(conv, 'convertToPdf').mockImplementation(async () => {
      if (pdf === null) throw new BadRequestException('Could not convert the PPTX file to PDF.');
      return { pdf, pdfSize: pdf.length };
    });
    return conv;
  };

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slides-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    for (const entry of fs.readdirSync(tmpDir)) {
      fs.rmSync(path.join(tmpDir, entry), { force: true });
    }
    prisma = {
      course: { findUnique: jest.fn() },
      slide: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { orderIndex: null } }),
      },
      $transaction: jest.fn((arg: unknown) =>
        Array.isArray(arg) ? Promise.all(arg) : Promise.resolve([]),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SlidesService,
        SlideStorageService,
        MalwareScanService,
        { provide: PptxConversionService, useValue: conversion() },
        { provide: PdfSplitService, useValue: pdfSplit([Buffer.from('%PDF-1.4 fake-pdf')]) },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => tmpDir) },
        },
      ],
    }).compile();

    service = moduleRef.get(SlidesService);
    storage = moduleRef.get(SlideStorageService);
  });

  it('rejects EICAR payloads and mime/content mismatches', () => {
    const scan = new MalwareScanService();
    const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    expect(() =>
      scan.scan('eicar.pdf', 'application/pdf', Buffer.from(`%PDF-1.4 ${eicar}`)),
    ).toThrow(BadRequestException);
    expect(() =>
      scan.scan('fake.pdf', 'application/pdf', Buffer.from('<html>not a pdf</html>')),
    ).toThrow(BadRequestException);
    expect(() =>
      scan.scan('ok.pdf', 'application/pdf', Buffer.from('%PDF-1.4 real')),
    ).not.toThrow();
  });

  it('rejects disallowed mime types', () => {
    expect(() => storage.assertValid('application/x-msdownload', 100)).toThrow(BadRequestException);
    expect(storage.isAllowedMimeType('application/pdf')).toBe(true);
    expect(storage.isAllowedMimeType('text/html')).toBe(false);
    expect(storage.isAllowedMimeType(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )).toBe(true);
  });

  it('accepts pptx magic bytes and rejects zip mimics', () => {
    const scan = new MalwareScanService();
    const pptxMime =
      'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    expect(() => scan.scan('deck.pptx', pptxMime, realPptx())).not.toThrow();
    expect(() => scan.scan('fake.pptx', pptxMime, Buffer.from('not a zip'))).toThrow(
      BadRequestException,
    );
  });

  it('converts pptx uploads to pdf (mime, size and stored bytes)', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
    prisma.slide.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'slide-2', createdAt: new Date(), ...data }),
    );
    const converted = conversion(fakePdf());
    const moduleRef = await Test.createTestingModule({
      providers: [
        SlidesService,
        SlideStorageService,
        MalwareScanService,
        { provide: PptxConversionService, useValue: converted },
        { provide: PdfSplitService, useValue: pdfSplit((b: Buffer) => Promise.resolve([b])) },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn(() => tmpDir) } },
      ],
    }).compile();
    const pptxService = moduleRef.get(SlidesService);

    const result = await pptxService.upload('course-1', file({
      originalname: 'deck.pptx',
      mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size: realPptx().length,
      buffer: realPptx(),
    }));

    expect(result).toHaveLength(1);
    expect(result[0].mimeType).toBe('application/pdf');
    expect(result[0].fileSize).toBe(fakePdf().length);
    expect(converted.convertToPdf).toHaveBeenCalledTimes(1);

    const stored = fs.readdirSync(tmpDir).find((f) => f.endsWith('.pdf'));
    expect(stored).toBeDefined();
    const storedBytes = fs.readFileSync(path.join(tmpDir, stored!));
    expect(storedBytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('splits a multi-page PDF into one slide per page with ordered titles', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
    prisma.slide.aggregate.mockResolvedValue({ _max: { orderIndex: 1 } });
    let seq = 0;
    prisma.slide.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `slide-${++seq}`, createdAt: new Date(), ...data }),
    );
    const parts = [
      Buffer.from('%PDF-1.4 page-1'),
      Buffer.from('%PDF-1.4 page-2'),
      Buffer.from('%PDF-1.4 page-3'),
    ];
    const moduleRef = await Test.createTestingModule({
      providers: [
        SlidesService,
        SlideStorageService,
        MalwareScanService,
        { provide: PptxConversionService, useValue: conversion() },
        { provide: PdfSplitService, useValue: pdfSplit(parts) },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn(() => tmpDir) } },
      ],
    }).compile();
    const splitService = moduleRef.get(SlidesService);

    const result = await splitService.upload('course-1', file({ originalname: 'deck.pdf' }));

    expect(result).toHaveLength(3);
    expect(result.map((s) => s.orderIndex)).toEqual([2, 3, 4]);
    expect(result[0].title).toBe('deck (1/3)');
    expect(result[2].title).toBe('deck (3/3)');
    expect(fs.readdirSync(tmpDir)).toHaveLength(3);
  });

  it('rejects the upload when pptx conversion fails', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
    const moduleRef = await Test.createTestingModule({
      providers: [
        SlidesService,
        SlideStorageService,
        MalwareScanService,
        { provide: PptxConversionService, useValue: conversion(null) },
        { provide: PdfSplitService, useValue: pdfSplit([fakePdf()]) },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn(() => tmpDir) } },
      ],
    }).compile();
    const pptxService = moduleRef.get(SlidesService);

    await expect(pptxService.upload('course-1', file({
      originalname: 'broken.pptx',
      mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size: realPptx().length,
      buffer: realPptx(),
    }))).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.slide.create).not.toHaveBeenCalled();
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
  });

  it('rejects files above the size limit', () => {
    expect(() => storage.assertValid('application/pdf', 101 * 1024 * 1024)).toThrow(
      BadRequestException,
    );
    expect(() => storage.assertValid('application/pdf', 90 * 1024 * 1024)).not.toThrow();
  });

  it('neutralizes path traversal in resolve (stays inside storage root)', () => {
    const resolved = storage.resolve('../outside.txt');
    expect(resolved.startsWith(path.resolve(tmpDir))).toBe(true);
    expect(resolved).not.toContain('..');
  });

  it('uploads a valid file and appends orderIndex', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
    prisma.slide.aggregate.mockResolvedValue({ _max: { orderIndex: 2 } });
    prisma.slide.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'slide-1', createdAt: new Date(), ...data }),
    );

    const result = await service.upload('course-1', file());

    expect(result).toHaveLength(1);
    expect(result[0].orderIndex).toBe(3);
    expect(result[0].mimeType).toBe('application/pdf');
    expect(result[0].title).toBe('intro');
    expect(prisma.slide.create).toHaveBeenCalled();
  });

  it('cleans up the stored file when the DB insert fails', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
    prisma.slide.create.mockRejectedValue(new Error('db down'));

    await expect(service.upload('course-1', file())).rejects.toThrow('db down');

    const files = fs.readdirSync(tmpDir);
    expect(files).toHaveLength(0);
  });

  it('rejects upload when the course does not exist', async () => {
    prisma.course.findUnique.mockResolvedValue(null);
    await expect(service.upload('nope', file())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates reorder payloads: duplicates, foreign ids, incomplete lists', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'c' });
    prisma.slide.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    prisma.slide.update.mockResolvedValue({});

    await expect(service.reorder('c', ['a', 'a'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reorder('c', ['a', 'x'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reorder('c', ['a'])).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.reorder('c', ['b', 'a'])).resolves.not.toThrow();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('deletes the slide row and stored file', async () => {
    prisma.slide.findUnique.mockResolvedValue({ id: 's1', filePath: 'stored.pdf' });
    await service.remove('s1');
    expect(prisma.slide.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});
