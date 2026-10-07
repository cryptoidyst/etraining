import { registerAs } from '@nestjs/config';

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: int(process.env.PORT, 3001),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'change-me',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));

export const adConfig = registerAs('ad', () => ({
  url: process.env.AD_URL ?? 'ldaps://dc01.lab.local:636',
  baseDn: process.env.AD_BASE_DN ?? 'DC=lab,DC=local',
  domain: process.env.AD_DOMAIN ?? 'lab.local',
  netbios: process.env.AD_NETBIOS ?? 'LAB',
  bindDn: process.env.AD_BIND_DN ?? '',
  bindPassword: process.env.AD_BIND_PASSWORD ?? '',
  attrs: {
    username: process.env.AD_ATTR_USERNAME ?? 'sAMAccountName',
    email: process.env.AD_ATTR_EMAIL ?? 'mail',
    fullName: process.env.AD_ATTR_FULLNAME ?? 'displayName',
    employeeId: process.env.AD_ATTR_EMPLOYEE_ID ?? 'employeeID',
    department: process.env.AD_ATTR_DEPARTMENT ?? 'department',
    jobTitle: process.env.AD_ATTR_JOB_TITLE ?? 'title',
    groups: process.env.AD_ATTR_GROUPS ?? 'memberOf',
    enabled: process.env.AD_ATTR_ENABLED ?? 'userAccountControl',
  },
  groupAdmin: process.env.AD_GROUP_ADMIN ?? 'Training-Admins',
  groupStaff: process.env.AD_GROUP_STAFF ?? 'Training-Staff',
  tlsRejectUnauthorized: bool(process.env.AD_TLS_REJECT_UNAUTHORIZED, true),
  timeoutMs: int(process.env.AD_TIMEOUT_MS, 10000),
}));

export const storageConfig = registerAs('storage', () => ({
  slidesDir: process.env.SLIDES_DIR ?? './uploads/slides',
  sofficePath: process.env.SOFFICE_PATH ?? '',
}));

export default [appConfig, jwtConfig, adConfig, storageConfig];
