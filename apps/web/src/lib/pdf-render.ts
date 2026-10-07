'use client';

import type { Slide } from './slides-api';
import { fetchSlideBlob } from './slides-api';

/**
 * Renders slide files to plain images so the viewer shows <img> elements
 * instead of an <iframe> per PDF. Two payoffs:
 *   - no PDF-plugin teardown/re-init on every slide change
 *   - slides can be preloaded and cross-faded like images
 *
 * PDFs are rasterised with pdf.js; other types are used as-is. Results are
 * cached (LRU) so navigating back and forth is instant.
 */

const WORKER_SRC = '/pdf/pdf.worker.min.mjs';
const STANDARD_FONT_DATA_URL = '/pdf/standard_fonts/';
const CMAP_URL = '/pdf/cmaps/';

/** Width (px) a PDF page is rasterised at before scaling down to fit. */
const TARGET_PDF_WIDTH = 1600;
const MAX_SCALE = 4;

/** How many rendered slides to keep in memory before evicting the oldest. */
const MAX_CACHED_IMAGES = 24;

export interface SlideImage {
  url: string;
  width: number;
  height: number;
}

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      return mod;
    });
  }
  return pdfjsPromise;
}

const resolved = new Map<string, SlideImage>();
const pending = new Map<string, Promise<SlideImage>>();
const lru: string[] = [];

function touch(slideId: string): void {
  const at = lru.indexOf(slideId);
  if (at !== -1) lru.splice(at, 1);
  lru.push(slideId);
  while (lru.length > MAX_CACHED_IMAGES) {
    const evicted = lru.shift();
    if (!evicted) break;
    const image = resolved.get(evicted);
    resolved.delete(evicted);
    if (image) URL.revokeObjectURL(image.url);
  }
}

/**
 * Synchronously returns an already-rendered slide, if present. Refreshes the
 * slide's LRU position so a re-visited slide is never evicted while visible.
 */
export function peekSlideImage(slideId: string): SlideImage | undefined {
  const image = resolved.get(slideId);
  if (image) touch(slideId);
  return image;
}

function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const probe = new Image();
    probe.onload = () =>
      resolve({ width: probe.naturalWidth || TARGET_PDF_WIDTH, height: probe.naturalHeight || 900 });
    probe.onerror = () => reject(new Error('Could not load the slide image.'));
    probe.src = url;
  });
}

async function renderPdf(blob: Blob): Promise<SlideImage> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise;
  try {
    const page = await doc.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_SCALE, Math.max(1, TARGET_PDF_WIDTH / unscaled.width));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is not available in this browser.');

    await page.render({ canvasContext: context, viewport }).promise;

    const outBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Could not encode the slide.'))),
        'image/png',
      );
    });
    return { url: URL.createObjectURL(outBlob), width: canvas.width, height: canvas.height };
  } finally {
    void doc.destroy();
  }
}

async function createSlideImage(token: string, slide: Slide): Promise<SlideImage> {
  const { blob, mimeType } = await fetchSlideBlob(token, slide.id);
  const type = slide.mimeType || mimeType;
  if (type.includes('pdf')) {
    return renderPdf(blob);
  }
  const url = URL.createObjectURL(blob);
  try {
    const size = await imageSize(url);
    return { url, width: size.width, height: size.height };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Loads (and caches) the image for a slide. Repeat calls reuse the result. */
export function getSlideImage(token: string, slide: Slide): Promise<SlideImage> {
  const cached = resolved.get(slide.id);
  if (cached) {
    touch(slide.id);
    return Promise.resolve(cached);
  }
  const inFlight = pending.get(slide.id);
  if (inFlight) {
    touch(slide.id);
    return inFlight;
  }

  touch(slide.id);
  const promise = createSlideImage(token, slide)
    .then((image) => {
      resolved.set(slide.id, image);
      pending.delete(slide.id);
      return image;
    })
    .catch((error) => {
      pending.delete(slide.id);
      const at = lru.indexOf(slide.id);
      if (at !== -1) lru.splice(at, 1);
      throw error;
    });
  pending.set(slide.id, promise);
  return promise;
}

/** Warms the cache for a slide without surfacing load errors. */
export function preloadSlideImage(token: string, slide: Slide): void {
  if (resolved.has(slide.id) || pending.has(slide.id)) return;
  void getSlideImage(token, slide).catch(() => undefined);
}
