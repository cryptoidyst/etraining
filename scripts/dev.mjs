import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

const COLORS = {
  api: '\x1b[36m',
  web: '\x1b[35m',
};
const RESET = '\x1b[0m';

const targets = [
  { name: 'api', args: ['--workspace', 'apps/api', 'run', 'start:dev'] },
  { name: 'web', args: ['--workspace', 'apps/web', 'run', 'dev'] },
];

const children = [];
let shuttingDown = false;

function prefixStream(name, stream) {
  const color = COLORS[name] ?? '';
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      process.stdout.write(`${color}[${name}]${RESET} ${line}\n`);
    }
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

for (const target of targets) {
  const child = spawn('npm', target.args, {
    cwd: root,
    shell: isWin,
    env: process.env,
  });
  prefixStream(target.name, child.stdout);
  prefixStream(target.name, child.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`\n[${target.name}] exited with code ${code}. Shutting down.`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Starting API (http://localhost:3001/api) and Web (http://localhost:3000)...');
console.log('Press Ctrl+C to stop both.\n');
