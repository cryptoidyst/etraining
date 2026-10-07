'use client';

import { api, ApiError } from './api';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface Slide {
  id: string;
  courseId: string;
  title: string;
  mimeType: string;
  fileSize: number;
  orderIndex: number;
  createdAt: string;
}

export async function listSlides(token: string, courseId: string): Promise<Slide[]> {
  return api<Slide[]>(`/courses/${courseId}/slides`, { token });
}

/**
 * Uploads a slide. A multi-page PDF is split server-side into one slide per
 * page, so the resolved value contains every created slide in order.
 */
export async function uploadSlide(
  token: string,
  courseId: string,
  file: File,
  title?: string,
): Promise<Slide[]> {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  return api<Slide[]>(`/courses/${courseId}/slides`, {
    method: 'POST',
    body: form,
    token,
  });
}

export async function renameSlide(
  token: string,
  slideId: string,
  title: string,
): Promise<Slide> {
  return api<Slide>(`/slides/${slideId}`, { method: 'PATCH', body: { title }, token });
}

export async function reorderSlides(
  token: string,
  courseId: string,
  slideIds: string[],
): Promise<Slide[]> {
  return api<Slide[]>(`/courses/${courseId}/slides/order`, {
    method: 'PATCH',
    body: { slideIds },
    token,
  });
}

export async function deleteSlide(token: string, slideId: string): Promise<void> {
  return api<void>(`/slides/${slideId}`, { method: 'DELETE', token });
}

/**
 * Fetches a slide's bytes. Callers decide how to present them: PDFs are
 * rendered to an image, other types are shown directly via an object URL.
 */
export async function fetchSlideBlob(
  token: string,
  slideId: string,
): Promise<{ blob: Blob; mimeType: string }> {
  const response = await fetch(`${baseUrl}/slides/${slideId}/file`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    let message = `Failed to load slide (${response.status})`;
    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      /* keep default */
    }
    throw new ApiError(response.status, message);
  }
  const mimeType = response.headers.get('Content-Type') ?? 'application/octet-stream';
  const blob = await response.blob();
  return { blob, mimeType };
}
