// `yarn start:local [--demo]`: loads `.env` from the repository root (copy
// `.env.example` first), then starts the backend and the frontend dev server.
// What is already set in the shell wins over `.env`; `--demo` turns the demo
// sign-in on for this run only. Stop both with Ctrl+C.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(backend, '..', '..');

// The option parsing and the environment rules are TypeScript with tests, so
// build them first.
const build = spawnSync('yarn', ['workspace', 'backend', 'build'], {
  cwd: repo,
  stdio: 'inherit',
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}
const { buildStartEnv, parseEnvFile, parseStartArgs } = await import(
  join(backend, 'dist', 'startLocal', 'startEnv.js')
);

let flags;
try {
  flags = parseStartArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const envFile = join(repo, '.env');
if (!existsSync(envFile)) {
  console.error(
    'There is no .env file. Copy .env.example to .env first (cp .env.example .env).',
  );
  process.exit(1);
}
const env = buildStartEnv(
  process.env,
  parseEnvFile(readFileSync(envFile, 'utf8')),
  flags,
);

const children = ['backend', 'app'].map(name =>
  spawn('yarn', ['workspace', name, 'start'], {
    cwd: repo,
    env,
    stdio: 'inherit',
  }),
);
const stop = () => children.forEach(child => child.kill('SIGINT'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const progress = { finished: 0 };
children.forEach(child => {
  child.on('exit', code => {
    progress.finished += 1;
    if (progress.finished === 1) {
      stop();
    }
    if (progress.finished === children.length) {
      process.exit(code ?? 0);
    }
  });
});
