'use client';

import { api, ApiError } from './api';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export type QuestionType = 'multiple_choice' | 'true_false';

export interface QuestionOption {
  id?: string;
  text: string;
  isCorrect: boolean;
  orderIndex?: number;
}

export interface Question {
  id: string;
  courseId: string;
  setIndex: number;
  orderIndex: number;
  type: QuestionType;
  text: string;
  imagePath: string | null;
  imageMime: string | null;
  options: QuestionOption[];
  createdAt: string;
}

export interface QuestionListResponse {
  items: Question[];
  total: number;
}

export interface QuestionQuery {
  type?: QuestionType;
  setIndex?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

const questionsUrl = (courseId: string) => `/courses/${courseId}/questions`;

export async function listQuestions(
  token: string,
  courseId: string,
  query: QuestionQuery = {},
): Promise<QuestionListResponse> {
  const params = new URLSearchParams();
  if (query.type) params.set('type', query.type);
  if (query.setIndex !== undefined) params.set('setIndex', String(query.setIndex));
  if (query.search) params.set('search', query.search);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));
  const qs = params.toString();
  return api<QuestionListResponse>(`${questionsUrl(courseId)}${qs ? `?${qs}` : ''}`, { token });
}

export async function getQuestion(
  token: string,
  courseId: string,
  id: string,
): Promise<Question> {
  return api<Question>(`${questionsUrl(courseId)}/${id}`, { token });
}

export async function createQuestion(
  token: string,
  courseId: string,
  input: {
    type: QuestionType;
    text: string;
    options: { text: string; isCorrect: boolean }[];
    setIndex?: number;
  },
): Promise<Question> {
  return api<Question>(questionsUrl(courseId), { method: 'POST', body: input, token });
}

export async function updateQuestion(
  token: string,
  courseId: string,
  id: string,
  input: { text?: string; options?: { text: string; isCorrect: boolean }[]; setIndex?: number },
): Promise<Question> {
  return api<Question>(`${questionsUrl(courseId)}/${id}`, { method: 'PATCH', body: input, token });
}

export async function deleteQuestion(token: string, courseId: string, id: string): Promise<void> {
  return api<void>(`${questionsUrl(courseId)}/${id}`, { method: 'DELETE', token });
}

export async function reorderQuestions(
  token: string,
  courseId: string,
  setIndex: number,
  questionIds: string[],
): Promise<Question[]> {
  return api<Question[]>(`${questionsUrl(courseId)}/order/${setIndex}`, {
    method: 'PUT',
    body: { questionIds },
    token,
  });
}

export interface BulkImportResult {
  created: number;
  failed: number;
  errors: string[];
}

export async function bulkCreateQuestions(
  token: string,
  courseId: string,
  text: string,
  setIndex = 1,
): Promise<BulkImportResult> {
  return api<BulkImportResult>(`${questionsUrl(courseId)}/bulk`, {
    method: 'POST',
    body: { text, setIndex },
    token,
  });
}

export async function uploadQuestionImage(
  token: string,
  courseId: string,
  id: string,
  file: File,
): Promise<Question> {
  const form = new FormData();
  form.append('file', file);
  return api<Question>(`${questionsUrl(courseId)}/${id}/image`, {
    method: 'POST',
    body: form,
    token,
  });
}

export async function deleteQuestionImage(
  token: string,
  courseId: string,
  id: string,
): Promise<Question> {
  return api<Question>(`${questionsUrl(courseId)}/${id}/image`, { method: 'DELETE', token });
}

export async function fetchQuestionImage(
  token: string,
  courseId: string,
  questionId: string,
): Promise<string | null> {
  const response = await fetch(`${baseUrl}${questionsUrl(courseId)}/${questionId}/image`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export { ApiError };
