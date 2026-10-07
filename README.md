# E-Training System

Internal training platform. Admins build courses with slides and quizzes; staff read slides, take quizzes, and get a completion result.

- **Stack:** Next.js + NestJS + PostgreSQL + Prisma + LDAPS (Active Directory)
- **Docs:** see `memory.md`, `MODULE-BUILD-PLAN.md`, `tech-stack.md`, `etraining-system-blueprint.md`, `etraining-erd.md`

## Repository layout

```text
etraining/
  apps/
    api/        NestJS API (Module 1: authentication)
    web/        Next.js frontend (added in a later step)
  package.json  npm workspaces root
```

## Module 1 status — Authentication and User Management

Implemented:

- LDAPS integration (`ldapts`): service-account bind, user search, user-credential bind, attribute read, group → role mapping
- `POST /api/auth/login` — validates against AD, upserts the local user, issues a JWT
- `GET /api/auth/me` — returns the current user (JWT required)
- `POST /api/auth/logout`
- `@Roles()` decorator + `RolesGuard` for RBAC (used by later modules)
- Prisma schema for `roles`, `departments`, `users`
- Seed for default roles and sample departments
- Swagger docs at `/api/docs`
- Unit tests for the auth service and role mapping

Not yet included (later modules): refresh tokens, password change, user admin screens, frontend login page.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- (Optional, for real auth) a Windows Server VM with Active Directory

## Setup

```powershell
# 1. Install dependencies from the repo root
npm install

# 2. Configure environment
Copy-Item apps\api\.env.example apps\api\.env
# then edit apps\api\.env with your database and AD values

# 3. Generate the Prisma client
npm --workspace apps/api run prisma:generate

# 4. Create the database tables
npm --workspace apps/api run prisma:migrate

# 5. Seed roles and departments
npm --workspace apps/api run db:seed

# 6. Run the API
npm run api:dev
```

API: `http://localhost:3001/api` — Swagger: `http://localhost:3001/api/docs`

## Environment variables

See `apps/api/.env.example`. Key groups:

| Group | Variables |
|-------|-----------|
| App | `NODE_ENV`, `PORT`, `CORS_ORIGINS` |
| Database | `DATABASE_URL` |
| JWT | `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
| AD/LDAPS | `AD_URL`, `AD_BASE_DN`, `AD_DOMAIN`, `AD_NETBIOS`, `AD_BIND_DN`, `AD_BIND_PASSWORD`, `AD_ATTR_*`, `AD_GROUP_ADMIN`, `AD_GROUP_STAFF`, `AD_TLS_REJECT_UNAUTHORIZED`, `AD_TIMEOUT_MS` |

Generate a JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Setting up Active Directory on a Windows Server VM

You do **not** need to buy a domain. Use a private/internal name such as `lab.local`.

### 1. Install AD DS

1. Create a Windows Server VM.
2. Server Manager → **Add Roles and Features** → install **Active Directory Domain Services**.
3. Promote the server to a domain controller, creating a new forest, e.g. `lab.local`.
4. Set the VM's DNS to point to itself (`127.0.0.1`).

### 2. Create groups and users

Open **Active Directory Users and Computers**:

- Create groups:
  - `Training-Admins`
  - `Training-Staff`
- Create a test user (e.g. `jdoe`) and add them to `Training-Staff`.
- Create a read-only service account (e.g. `svc-etraining`) and add it to `Domain Users` only.

### 3. Provide LDAPS (port 636)

The DC needs a certificate with **Server Authentication** purpose.

- Install the **Active Directory Certificate Services (AD CS)** role and issue a certificate to the DC, **or** request a DC certificate from your internal CA.
- Verify on the DC:

```powershell
certutil -store My
```

You should see a certificate usable for LDAP/Server Authentication.

### 4. Point the app at the DC

Update `apps/api/.env`:

```env
AD_URL=ldaps://dc01.lab.local:636
AD_BASE_DN=DC=lab,DC=local
AD_DOMAIN=lab.local
AD_NETBIOS=LAB
AD_BIND_DN=CN=svc-etraining,CN=Users,DC=lab,DC=local
AD_BIND_PASSWORD=<service account password>
AD_TLS_REJECT_UNAUTHORIZED=true
```

For a **lab only**, if the DC uses a self-signed cert and you have not imported the CA, set `AD_TLS_REJECT_UNAUTHORIZED=false` to test. Never do this in production.

If the DC has no LDAPS certificate yet, test with plain LDAP first:

```env
AD_URL=ldap://dc01.lab.local:389
```

### 5. Verify the connection

```powershell
openssl s_client -connect dc01.lab.local:636 -showcerts
```

## Testing login

```powershell
curl -X POST http://localhost:3001/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"jdoe\",\"password\":\"YourPassword\"}"
```

Expected: `200` with an `accessToken` and the user's role. Wrong password → `401`. Disabled account or no mapped group → `403`.

## Useful commands

```powershell
npm run api:dev              # API in watch mode
npm --workspace apps/api run test        # unit tests
npm --workspace apps/api run lint
npm --workspace apps/api run typecheck
npm --workspace apps/api run prisma:studio
```

## Security notes

- AD passwords are **never stored** — the user's own credentials are used only to bind against AD.
- The read-only service account is used only to search the directory.
- LDAPS only; no unencrypted LDAP in production.
- Keep `.env` out of version control (already in `.gitignore`).
