'use client';

import { api } from './api';

export interface DashboardReport {
  totalUsers: number;
  pendingApprovals: number;
  totalCourses: number;
  publishedCourses: number;
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  overdueAssignments: number;
  averageBestScore: number | null;
  totalAttempts: number;
}

export interface CourseReportRow {
  userId: string;
  fullName: string;
  departmentName: string | null;
  dueDate: string | null;
  status: 'completed' | 'in_progress' | 'not_started' | 'overdue';
  slidesViewed: number;
  slideCount: number;
  bestScore: number | null;
  attemptsUsed: number;
  passed: boolean;
  completedAt: string | null;
}

export interface CourseReport {
  courseId: string;
  courseTitle: string;
  items: CourseReportRow[];
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  averageScore: number | null;
}

export interface StaffTranscriptItem {
  courseId: string;
  courseTitle: string;
  status: 'completed' | 'in_progress' | 'not_started' | 'overdue';
  slidesViewed: number;
  slideCount: number;
  bestScore: number | null;
  attemptsUsed: number;
  passed: boolean;
  dueDate: string | null;
  completedAt: string | null;
  lastAttemptAt: string | null;
}

export interface StaffTranscript {
  userId: string;
  fullName: string;
  departmentName: string | null;
  jobTitle: string | null;
  assignedCourses: number;
  completedCourses: number;
  items: StaffTranscriptItem[];
}

export interface OverdueItem {
  assignmentId: string;
  courseId: string;
  courseTitle: string;
  userId: string;
  fullName: string;
  departmentName: string | null;
  dueDate: string;
  slidesViewed: number;
  slideCount: number;
  passed: boolean;
  daysOverdue: number;
}

export async function getDashboardReport(token: string): Promise<DashboardReport> {
  return api<DashboardReport>('/reports/dashboard', { token });
}

export async function getCourseReport(
  token: string,
  courseId: string,
  query: { departmentId?: string; limit?: number; offset?: number } = {},
): Promise<CourseReport> {
  const params = new URLSearchParams();
  if (query.departmentId) params.set('departmentId', query.departmentId);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));
  const qs = params.toString();
  return api<CourseReport>(`/reports/courses/${courseId}${qs ? `?${qs}` : ''}`, { token });
}

export async function getStaffTranscript(
  token: string,
  userId: string,
): Promise<StaffTranscript> {
  return api<StaffTranscript>(`/reports/staff/${userId}`, { token });
}

export async function getOverdueReport(
  token: string,
  query: { departmentId?: string } = {},
): Promise<OverdueItem[]> {
  const params = new URLSearchParams();
  if (query.departmentId) params.set('departmentId', query.departmentId);
  const qs = params.toString();
  return api<OverdueItem[]>(`/reports/overdue${qs ? `?${qs}` : ''}`, { token });
}
