'use client';

import { api } from './api';
import type { QuestionType } from './questions-api';

export interface AttachedQuestion {
  questionId: string;
  orderIndex: number;
  setIndex: number;
  type: QuestionType;
  text: string;
  imagePath: string | null;
  optionTexts: string[];
}

export interface QuizConfig {
  courseId: string;
  questionCount: number;
  minQuestions: number;
  sets: { setIndex: number; count: number }[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  passingScore: number;
  allowRetake: boolean;
  maxAttempts: number | null;
  isValid: boolean;
}

export async function listAttachedQuestions(
  token: string,
  courseId: string,
  setIndex?: number,
): Promise<AttachedQuestion[]> {
  const qs = setIndex !== undefined ? `?setIndex=${setIndex}` : '';
  return api<AttachedQuestion[]>(`/courses/${courseId}/quiz/questions${qs}`, { token });
}

export async function getQuizConfig(token: string, courseId: string): Promise<QuizConfig> {
  return api<QuizConfig>(`/courses/${courseId}/quiz/config`, { token });
}

export async function updateQuizConfig(
  token: string,
  courseId: string,
  input: {
    passingScore?: number;
    allowRetake?: boolean;
    maxAttempts?: number | null;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
  },
): Promise<QuizConfig> {
  return api<QuizConfig>(`/courses/${courseId}/quiz/config`, {
    method: 'PATCH',
    body: input,
    token,
  });
}
