import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

const adminUsername = requiredEnv('SEED_ADMIN_USERNAME');
const adminPassword = requiredEnv('SEED_ADMIN_PASSWORD');
const adminEmail = requiredEnv('SEED_ADMIN_EMAIL');

const roles = [
  { name: 'administrator', description: 'Full administrative access to the training system' },
  { name: 'staff', description: 'Access to assigned training courses' },
];

const permissions = [
  { code: 'users.read', description: 'View user accounts' },
  { code: 'users.approve', description: 'Approve or reject registrations' },
  { code: 'roles.read', description: 'View roles and permissions' },
  { code: 'roles.manage', description: 'Create, update, and delete roles' },
  { code: 'departments.read', description: 'View departments' },
  { code: 'departments.manage', description: 'Create, update, and delete departments' },
  { code: 'staff.read', description: 'View staff records' },
  { code: 'staff.manage', description: 'Create, update, and deactivate staff' },
  { code: 'courses.read', description: 'View courses' },
  { code: 'courses.manage', description: 'Create, update, publish, and delete courses' },
  { code: 'slides.manage', description: 'Upload, order, and delete slides' },
  { code: 'questions.read', description: 'View question bank' },
  { code: 'questions.manage', description: 'Create, update, and delete questions' },
  { code: 'quiz.manage', description: 'Configure course quizzes and rules' },
  { code: 'assignments.read', description: 'View course assignments' },
  { code: 'assignments.manage', description: 'Assign courses to staff or departments' },
  { code: 'quiz.take', description: 'Read slides and take quizzes' },
  { code: 'reports.read', description: 'View reports and dashboard' },
  { code: 'settings.manage', description: 'Manage system settings' },
];

const rolePermissions: Record<string, string[]> = {
  administrator: permissions.map((p) => p.code),
  staff: ['courses.read', 'quiz.take'],
};

async function main(): Promise<void> {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { ...role, isSystem: true },
    });
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const [roleName, codes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    for (const code of codes) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const administrator = await prisma.role.findUniqueOrThrow({
    where: { name: 'administrator' },
  });

  const passwordHash = await argon2.hash(adminPassword);
  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      authProvider: 'local',
      approvalStatus: 'approved',
      approvedAt: new Date(),
      rejectionReason: null,
      roleId: administrator.id,
      isActive: true,
    },
    create: {
      username: adminUsername,
      passwordHash,
      authProvider: 'local',
      approvalStatus: 'approved',
      approvedAt: new Date(),
      email: adminEmail,
      fullName: 'System Administrator',
      roleId: administrator.id,
      isActive: true,
    },
  });

  console.log(
    `Seeded ${roles.length} roles, ${permissions.length} permissions, and admin user "${adminUsername}".`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
