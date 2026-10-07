export interface AuthUser {
  id: string;
  username: string;
  adUsername: string | null;
  authProvider: 'local' | 'ad';
  email: string | null;
  fullName: string;
  employeeId: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  role: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: string;
  user: AuthUser;
}

export interface RegisterResponse {
  user: AuthUser;
  message: string;
}
