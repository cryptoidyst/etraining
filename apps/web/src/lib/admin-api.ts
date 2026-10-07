import { api } from './api';

export interface ManagedUser {
  id: string;
  username: string;
  adUsername: string | null;
  authProvider: string;
  email: string | null;
  fullName: string;
  departmentName: string | null;
  role: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export type ListUsersFilter = 'all' | 'pending' | 'approved' | 'rejected';

export async function listUsers(
  token: string,
  status: ListUsersFilter,
): Promise<ManagedUser[]> {
  const query = status === 'all' ? '' : `?status=${status}`;
  return api<ManagedUser[]>(`/users${query}`, { token });
}

export async function approveUser(
  token: string,
  userId: string,
  input: { departmentId: string; role?: 'administrator' | 'staff' },
): Promise<ManagedUser> {
  return api<ManagedUser>(`/users/${userId}/approve`, {
    method: 'PATCH',
    body: input,
    token,
  });
}

export async function rejectUser(
  token: string,
  userId: string,
  reason?: string,
): Promise<ManagedUser> {
  return api<ManagedUser>(`/users/${userId}/reject`, {
    method: 'PATCH',
    body: { reason },
    token,
  });
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  staffCount: number;
}

export async function listDepartments(
  token: string,
  includeInactive = false,
): Promise<Department[]> {
  const query = includeInactive ? '?includeInactive=true' : '';
  return api<Department[]>(`/departments${query}`, { token });
}

export async function createDepartment(
  token: string,
  input: { name: string; code: string; description?: string },
): Promise<Department> {
  return api<Department>('/departments', { method: 'POST', body: input, token });
}

export async function updateDepartment(
  token: string,
  id: string,
  input: { name?: string; description?: string; isActive?: boolean },
): Promise<Department> {
  return api<Department>(`/departments/${id}`, { method: 'PATCH', body: input, token });
}

export async function deleteDepartment(token: string, id: string): Promise<void> {
  return api<void>(`/departments/${id}`, { method: 'DELETE', token });
}

export interface StaffMember {
  id: string;
  username: string;
  adUsername: string | null;
  authProvider: string;
  email: string | null;
  fullName: string;
  employeeId: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  role: string;
  approvalStatus: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface StaffQuery {
  search?: string;
  departmentId?: string;
  role?: 'administrator' | 'staff';
}

export async function listStaff(token: string, query: StaffQuery = {}): Promise<StaffMember[]> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.departmentId) params.set('departmentId', query.departmentId);
  if (query.role) params.set('role', query.role);
  const qs = params.toString();
  return api<StaffMember[]>(`/staff${qs ? `?${qs}` : ''}`, { token });
}

export async function updateStaff(
  token: string,
  id: string,
  input: {
    fullName?: string;
    email?: string | null;
    employeeId?: string | null;
    jobTitle?: string | null;
    departmentId?: string | null;
    isActive?: boolean;
  },
): Promise<StaffMember> {
  return api<StaffMember>(`/staff/${id}`, { method: 'PATCH', body: input, token });
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  passingScore: number;
  allowRetake: boolean;
  maxAttempts: number | null;
  publishedAt: string | null;
  createdAt: string;
  slideCount: number;
}

export type CourseStatusFilter = 'all' | 'draft' | 'published' | 'archived';

export async function listCourses(
  token: string,
  query: { status?: CourseStatusFilter; search?: string } = {},
): Promise<Course[]> {
  const params = new URLSearchParams();
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  const qs = params.toString();
  return api<Course[]>(`/courses${qs ? `?${qs}` : ''}`, { token });
}

export async function getCourse(token: string, id: string): Promise<Course> {
  return api<Course>(`/courses/${id}`, { token });
}

export async function createCourse(
  token: string,
  input: {
    title: string;
    description?: string;
    passingScore?: number;
    allowRetake?: boolean;
    maxAttempts?: number | null;
  },
): Promise<Course> {
  return api<Course>('/courses', { method: 'POST', body: input, token });
}

export async function updateCourse(
  token: string,
  id: string,
  input: {
    title?: string;
    description?: string;
    passingScore?: number;
    allowRetake?: boolean;
    maxAttempts?: number | null;
  },
): Promise<Course> {
  return api<Course>(`/courses/${id}`, { method: 'PATCH', body: input, token });
}

export async function publishCourse(token: string, id: string): Promise<Course> {
  return api<Course>(`/courses/${id}/publish`, { method: 'POST', token });
}

export async function unpublishCourse(token: string, id: string): Promise<Course> {
  return api<Course>(`/courses/${id}/unpublish`, { method: 'POST', token });
}

export async function archiveCourse(token: string, id: string): Promise<Course> {
  return api<Course>(`/courses/${id}/archive`, { method: 'POST', token });
}

export async function deleteCourse(token: string, id: string): Promise<void> {
  return api<void>(`/courses/${id}`, { method: 'DELETE', token });
}

export async function listCatalog(token: string): Promise<Course[]> {
  return api<Course[]>('/courses/catalog', { token });
}
