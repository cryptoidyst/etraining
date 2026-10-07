'use client';

import { api } from './api';

export interface AssignmentRow {
  id: string;
  courseId: string;
  userId: string;
  targetType: 'user' | 'department';
  targetId: string;
  dueDate: string | null;
  createdAt: string;
  course: { title: string };
  user: { fullName: string; department: { name: string } | null };
}

export interface CourseAssignmentItem {
  userId: string;
  fullName: string;
  departmentName: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface CourseAssignmentsResponse {
  items: CourseAssignmentItem[];
  total: number;
}

export interface MyTrainingItem {
  assignmentId: string;
  courseId: string;
  courseTitle: string;
  courseDescription: string | null;
  dueDate: string | null;
  assignedAt: string;
  slideCount: number;
  slidesViewed: number;
  allSlidesViewed: boolean;
  quizQuestionCount: number | null;
  quizPassed: boolean | null;
}

export interface CreateAssignmentInput {
  courseId: string;
  targetType: 'user' | 'department';
  targetId: string;
  dueDate?: string | null;
}

export async function createAssignment(
  token: string,
  input: CreateAssignmentInput,
): Promise<{ created: number; skipped: number }> {
  return api<{ created: number; skipped: number }>('/assignments', {
    method: 'POST',
    body: input,
    token,
  });
}

export async function listAssignments(
  token: string,
  query: { courseId?: string; userId?: string; departmentId?: string; overdue?: boolean } = {},
): Promise<AssignmentRow[]> {
  const params = new URLSearchParams();
  if (query.courseId) params.set('courseId', query.courseId);
  if (query.userId) params.set('userId', query.userId);
  if (query.departmentId) params.set('departmentId', query.departmentId);
  if (query.overdue) params.set('overdue', 'overdue');
  const qs = params.toString();
  return api<AssignmentRow[]>(`/assignments${qs ? `?${qs}` : ''}`, { token });
}

export async function listCourseAssignments(
  token: string,
  courseId: string,
  pagination: { limit?: number; offset?: number } = {},
): Promise<CourseAssignmentsResponse> {
  const params = new URLSearchParams();
  if (pagination.limit !== undefined) params.set('limit', String(pagination.limit));
  if (pagination.offset !== undefined) params.set('offset', String(pagination.offset));
  const qs = params.toString();
  return api<CourseAssignmentsResponse>(`/courses/${courseId}/assignments${qs ? `?${qs}` : ''}`, {
    token,
  });
}

export async function updateAssignment(
  token: string,
  id: string,
  input: { dueDate?: string | null },
): Promise<AssignmentRow> {
  return api<AssignmentRow>(`/assignments/${id}`, { method: 'PATCH', body: input, token });
}

export async function deleteAssignment(token: string, id: string): Promise<void> {
  return api<void>(`/assignments/${id}`, { method: 'DELETE', token });
}

export async function getMyTraining(token: string): Promise<MyTrainingItem[]> {
  return api<MyTrainingItem[]>('/my-training', { token });
}
