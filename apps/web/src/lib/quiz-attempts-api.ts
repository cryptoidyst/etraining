'use client';

import { api } from './api';

export interface QuizOption {
  optionId: string;
  text: string;
}

export interface AttemptQuestion {
  questionId: string;
  type: 'multiple_choice' | 'true_false';
  text: string;
  imagePath: string | null;
  options: QuizOption[];
}

export interface Attempt {
  attemptId: string;
  courseId: string;
  attemptNumber: number;
  status: string;
  questions: AttemptQuestion[];
}

export interface SubmitAnswerInput {
  questionId: string;
  selectedOptionIds: string[];
}

export interface SubmitResult {
  attemptId: string;
  attemptNumber: number;
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  passingScore: number;
  passed: boolean;
  canRetry: boolean;
  attemptsUsed: number;
  attemptsLeft: number | null;
  results: {
    questionId: string;
    isCorrect: boolean;
    questionText: string;
    correctOptionTexts: string[];
    selectedOptionTexts: string[];
  }[];
}

export interface QuizEligibility {
  courseId: string;
  assigned: boolean;
  allSlidesViewed: boolean;
  questionCount: number;
  minQuestions: number;
  sets: { setIndex: number; count: number }[];
  validSetCount: number;
  quizConfigured: boolean;
  quizReady: boolean;
  attemptsUsed: number;
  attemptsLeft: number | null;
  bestScore: number | null;
  passed: boolean | null;
  resumeAttemptId: string | null;
}

export interface CompletionInfo {
  courseId: string;
  userId: string;
  completed: boolean;
  bestScore: number | null;
  bestAttemptId: string | null;
  completedAt: string | null;
  attemptsUsed: number;
  slideCount: number;
  slidesViewed: number;
}

export async function getQuizEligibility(
  token: string,
  courseId: string,
): Promise<QuizEligibility> {
  return api<QuizEligibility>(`/courses/${courseId}/quiz/eligibility`, { token });
}

export async function startQuizAttempt(
  token: string,
  courseId: string,
): Promise<Attempt> {
  return api<Attempt>(`/courses/${courseId}/quiz/start`, {
    method: 'POST',
    body: {},
    token,
  });
}

export async function getAttempt(token: string, attemptId: string): Promise<Attempt> {
  return api<Attempt>(`/attempts/${attemptId}`, { token });
}

export async function submitQuizAttempt(
  token: string,
  attemptId: string,
  answers: SubmitAnswerInput[],
): Promise<SubmitResult> {
  return api<SubmitResult>(`/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: { answers },
    token,
  });
}

export async function getAttemptHistory(
  token: string,
  courseId: string,
): Promise<
  {
    id: string;
    attemptNumber: number;
    scorePercent: number | null;
    passed: boolean | null;
    status: string;
    startedAt: string;
    submittedAt: string | null;
  }[]
> {
  return api(`/courses/${courseId}/quiz/history`, { token });
}

export async function getCourseCompletion(
  token: string,
  courseId: string,
): Promise<CompletionInfo> {
  return api<CompletionInfo>(`/courses/${courseId}/completion`, { token });
}
