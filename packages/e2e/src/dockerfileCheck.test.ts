import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkDockerfile,
  checkDockerfileFiles,
  dockerfileCommand,
} from './dockerfileCheck';
import { repoRoot } from './repoRoot';

const root = repoRoot();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const appDockerfile = () => read('packages', 'backend', 'Dockerfile');
const appConfig = () => read('packages', 'backend', 'app-config.yaml');
const bad = () =>
  read('packages', 'e2e', 'src', 'testing', 'fixtures', 'Dockerfile.bad');

describe('packages/backend/Dockerfile (real file)', () => {
  it('breaks none of the rules', () => {
    expect(checkDockerfile(appDockerfile())).toEqual([]);
  });

  it('builds on the same base tag as the server image, set in one ARG', () => {
    const arg = /^ARG NODE_IMAGE=(\S+)$/m;
    const app = appDockerfile().match(arg)?.[1];
    const server = read('packages', 'guardrails-server', 'Dockerfile').match(
      arg,
    )?.[1];
    expect(app).toBeDefined();
    expect(app).toBe(server);
  });

  it('runs as a non-root user and exposes one port', () => {
    const text = appDockerfile();
    expect(text).toMatch(/^USER node$/m);
    expect(text.match(/^EXPOSE .*$/gm)).toEqual(['EXPOSE 7007']);
  });

  it('copies every file the start command and the settings name (NFR2.3)', () => {
    expect(checkDockerfileFiles(appDockerfile(), appConfig())).toEqual([]);
  });

  it('starts by copying the pristine static files, then the backend', () => {
    const command = dockerfileCommand(appDockerfile());
    expect(command).toMatch(/^cp -R \/app\/app-static-src\/\. /);
    expect(command).toMatch(
      /&& exec node packages\/backend --config app-config\.yaml --config app-config\.postgres\.yaml$/,
    );
  });

  it('has no secret argument, no latest tag and no copy of env files', () => {
    const text = appDockerfile();
    expect(text).not.toMatch(
      /^\s*(ARG|ENV)\s+\w*(PASSWORD|TOKEN|SECRET|KEY)/im,
    );
    expect(text).not.toMatch(/latest/);
    expect(text).not.toMatch(/COPY .*\.env/);
  });
});

describe('checkDockerfile (fixture proves the rules fail)', () => {
  it('finds every deliberate fault', () => {
    const found = checkDockerfile(bad()).join('\n');
    expect(found).toMatch(/NFR5\.4.*node:latest/);
    expect(found).toMatch(/NFR5\.4.*FROM alpine/);
    expect(found).toMatch(/NFR5\.3.*USER/);
    expect(found).toMatch(/NFR5\.3.*exactly one/);
    expect(found).toMatch(/NFR5\.2.*API_TOKEN/);
  });

  it('finds config files and the catalog that are not copied', () => {
    const found = checkDockerfileFiles(bad(), appConfig()).join('\n');
    expect(found).toMatch(/app-config\.postgres\.yaml/);
    expect(found).toMatch(/catalog/);
    expect(found).not.toMatch(/--config app-config\.yaml/);
  });

  it('finds a start command that is missing', () => {
    expect(
      checkDockerfile('FROM node:24.11.0-alpine3.22\nUSER node\nEXPOSE 1\n'),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/CMD/)]));
  });
});

describe('dockerfileCommand', () => {
  it('returns the last element of a shell-form JSON command', () => {
    expect(dockerfileCommand('CMD ["sh", "-c", "echo hi"]')).toBe('echo hi');
  });

  it('returns the joined words of an exec-form command, and undefined for none', () => {
    expect(dockerfileCommand('CMD ["node", "a.js"]')).toBe('node a.js');
    expect(dockerfileCommand('FROM x')).toBeUndefined();
  });
});
