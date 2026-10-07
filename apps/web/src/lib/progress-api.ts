'use client';

import { api } from './api';

export interface SlideView {
  slideId: string;
  viewedAt: string;
}

export interface CourseProgress {
  courseId: string;
  totalSlides: number;
  viewedSlides: number;
  percent: number;
  allSlidesViewed: boolean;
  viewed: SlideView[];
}

export async function recordSlideView(
  token: string,
  courseId: string,
  slideId: string,
): Promise<void> {
  await api<void>(`/courses/${courseId}/progress/slides/${slideId}/view`, {
    method: 'POST',
    token,
  });
}

export async function getCourseProgress(
  token: string,
  courseId: string,
): Promise<CourseProgress> {
  return api<CourseProgress>(`/courses/${courseId}/progress`, { token });
}
