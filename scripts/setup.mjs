import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

function run(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: isWin });
  if (result.status !== 0) {
    console.error(`\nCommand failed: ${command} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

function ensureEnv(example, target) {
  const examplePath = resolve(root, example);
  const targetPath = resolve(root, target);
  if (existsSync(targetPath)) {
    console.log(`env ok: ${target} already exists`);
    return;
  }
  if (!existsSync(examplePath)) {
    console.log(`env skip: ${example} not found`);
    return;
  }
  copyFileSync(examplePath, targetPath);
  console.log(`env created: ${target} (copied from ${example})`);
}

console.log('E-Training local setup');
console.log('======================');

ensureEnv('apps/api/.env.example', 'apps/api/.env');
ensureEnv('apps/web/.env.example', 'apps/web/.env');

run('npm', ['install']);

const apiEnv = resolve(root, 'apps/api/.env');
if (!existsSync(apiEnv)) {
  console.error('\napps/api/.env is missing. Fill it in (DATABASE_URL, JWT_SECRET, AD_*) then re-run.');
  process.exit(1);
}

run('npm', ['--workspace', 'apps/api', 'run', 'prisma:generate']);
run('npm', ['--workspace', 'apps/api', 'run', 'prisma:deploy']);
run('npm', ['--workspace', 'apps/api', 'run', 'db:seed']);

console.log('\nSetup complete. Start everything with:');
console.log('  npm run dev');
console.log('\nLocal admin login: admin / Admin@12345');
