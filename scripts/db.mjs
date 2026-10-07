import { spawnSync } from 'node:child_process';

const action = process.argv[2] ?? 'up';
const isWin = process.platform === 'win32';
const composeFile = 'docker-compose.db.yml';

function hasDocker() {
  const result = spawnSync('docker', ['--version'], { stdio: 'ignore', shell: isWin });
  return result.status === 0;
}

if (!hasDocker()) {
  console.log('Docker was not found on this machine.');
  console.log('');
  console.log('Options for running PostgreSQL locally:');
  console.log('  1. Install Docker Desktop, then re-run: npm run db:up');
  console.log('  2. Install PostgreSQL directly (postgresql.org/download/windows), then create the DB:');
  console.log('       psql -U postgres -c "CREATE USER etraining WITH PASSWORD \'etraining\';"');
  console.log('       psql -U postgres -c "CREATE DATABASE etraining OWNER etraining;"');
  console.log('  3. Point DATABASE_URL in apps/api/.env at any existing PostgreSQL server.');
  console.log('');
  console.log('Then run: npm run setup');
  process.exit(1);
}

const args =
  action === 'down'
    ? ['compose', '-f', composeFile, 'down']
    : ['compose', '-f', composeFile, 'up', '-d'];

console.log(`> docker ${args.join(' ')}`);
const result = spawnSync('docker', args, { stdio: 'inherit', shell: isWin });
if (result.status !== 0) process.exit(result.status ?? 1);

if (action !== 'down') {
  console.log('\nPostgreSQL is starting on localhost:5432 (user/pass: etraining/etraining).');
  console.log('Wait a few seconds, then run: npm run setup');
}
