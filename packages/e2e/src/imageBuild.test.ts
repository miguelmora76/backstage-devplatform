import {
  APP_IMAGE,
  buildImages,
  checkAppImageSize,
  checkImageConfig,
  imageSizeMb,
  IMAGES,
  MAX_APP_IMAGE_MB,
  SERVER_IMAGE,
} from './imageBuild';
import { fakeRunner, Rule } from './testing/fakeRunner';

const inspect = (config: object): Rule => ({
  when: ['ssh', 'inspect'],
  result: { stdout: JSON.stringify([{ Config: config }]) },
});
const size = (mb: string, status = 0): Rule => ({
  when: ['ssh', 'du'],
  result: { status, stdout: `${mb}\n` },
});

describe('buildImages (NFR5.15, NFR2.28)', () => {
  it('builds both images with minikube image build from the repository root', () => {
    const { run, calls } = fakeRunner([{ when: ['image', 'build'] }]);
    const logs: string[] = [];
    buildImages(run, '/repo', m => logs.push(m));
    expect(calls.map(c => c.line)).toEqual([
      'minikube --profile minikube image build -t guardrails-app:local -f packages/backend/Dockerfile .',
      'minikube --profile minikube image build -t guardrails-server:local -f packages/guardrails-server/Dockerfile .',
    ]);
    expect(calls.every(c => c.options?.cwd === '/repo')).toBe(true);
    expect(IMAGES.map(i => i.tag)).toEqual([APP_IMAGE, SERVER_IMAGE]);
    expect(logs.join('\n')).not.toMatch(/falling back/i);
  });

  it('falls back to a host docker build and minikube image load, and says so in one line', () => {
    let first = true;
    const { run, lines } = fakeRunner([
      {
        when: ['image', 'build'],
        result: () => {
          const failed = first;
          first = false;
          return failed ? { status: 137, stderr: 'killed' } : {};
        },
      },
      { when: ['docker', 'build'] },
      { when: ['image', 'load'] },
    ]);
    const logs: string[] = [];
    buildImages(run, '/repo', m => logs.push(m));
    expect(lines()).toEqual([
      'minikube --profile minikube image build -t guardrails-app:local -f packages/backend/Dockerfile .',
      'docker build -f packages/backend/Dockerfile -t guardrails-app:local .',
      'minikube --profile minikube image load guardrails-app:local',
      'minikube --profile minikube image build -t guardrails-server:local -f packages/guardrails-server/Dockerfile .',
    ]);
    const fallbackLines = logs.filter(l => /falling back/i.test(l));
    expect(fallbackLines).toHaveLength(1);
    expect(fallbackLines[0]).toContain(APP_IMAGE);
  });

  it('stops naming both attempts when the build and the fallback both fail', () => {
    const { run } = fakeRunner([
      { when: ['image', 'build'], result: { status: 137, stderr: 'oom' } },
      { when: ['docker', 'build'], result: { status: 1, stderr: 'no space' } },
    ]);
    expect(() => buildImages(run, '/repo', () => undefined)).toThrow(
      /minikube image build.*137.*oom[\s\S]*docker build.*no space/,
    );
  });

  it('stops when the host build works but the image cannot be loaded', () => {
    const { run } = fakeRunner([
      { when: ['image', 'build'], result: { status: 1 } },
      { when: ['docker', 'build'] },
      { when: ['image', 'load'], result: { status: 1, stderr: 'no node' } },
    ]);
    expect(() => buildImages(run, '/repo', () => undefined)).toThrow(
      /image load.*no node/,
    );
  });
});

describe('checkImageConfig (NFR5.15)', () => {
  it('accepts a named non-root user and exactly one exposed port', () => {
    const { run } = fakeRunner([
      inspect({ User: 'node', ExposedPorts: { '7007/tcp': {} } }),
    ]);
    expect(checkImageConfig(run, APP_IMAGE)).toEqual([]);
  });

  it.each(['', 'root', '0', '0:0'])(
    'finds the user "%s" as root or unset',
    user => {
      const { run } = fakeRunner([
        inspect({ User: user, ExposedPorts: { '7007/tcp': {} } }),
      ]);
      expect(checkImageConfig(run, APP_IMAGE).join('\n')).toMatch(
        /non-root user/,
      );
    },
  );

  it('finds two exposed ports and none', () => {
    const two = fakeRunner([
      inspect({
        User: 'node',
        ExposedPorts: { '7007/tcp': {}, '22/tcp': {} },
      }),
    ]);
    expect(checkImageConfig(two.run, APP_IMAGE).join('\n')).toMatch(
      /exactly one exposed port, found 2/,
    );
    const none = fakeRunner([inspect({ User: 'node' })]);
    expect(checkImageConfig(none.run, APP_IMAGE).join('\n')).toMatch(/found 0/);
  });

  it('reports an image that cannot be read instead of passing it', () => {
    const failed = fakeRunner([
      { when: ['ssh'], result: { status: 1, stderr: 'no such image' } },
    ]);
    expect(checkImageConfig(failed.run, APP_IMAGE).join('\n')).toMatch(
      /could not read.*no such image/i,
    );
    const garbage = fakeRunner([{ when: ['ssh'], result: { stdout: 'nope' } }]);
    expect(checkImageConfig(garbage.run, APP_IMAGE).join('\n')).toMatch(
      /could not read/i,
    );
  });
});

describe('image size (NFR1.8)', () => {
  it('reads the file-system size through a du run in the node', () => {
    const { run, calls } = fakeRunner([size('412')]);
    expect(imageSizeMb(run, APP_IMAGE)).toBe(412);
    expect(calls[0].line).toContain('du -sxm /');
    expect(calls[0].line).toContain(APP_IMAGE);
  });

  it('passes at exactly the limit and fails one MB above it', () => {
    const logs: string[] = [];
    expect(MAX_APP_IMAGE_MB).toBe(550);
    expect(
      checkAppImageSize(fakeRunner([size('550')]).run, m => logs.push(m)),
    ).toEqual([]);
    expect(logs.join('\n')).toContain('550 MB');
    expect(
      checkAppImageSize(fakeRunner([size('551')]).run, () => undefined).join(
        '\n',
      ),
    ).toMatch(/551 MB.*550 MB/);
  });

  it('reports a size that cannot be read', () => {
    expect(() => imageSizeMb(fakeRunner([size('abc')]).run, APP_IMAGE)).toThrow(
      /could not read the size/i,
    );
    expect(() => imageSizeMb(fakeRunner([size('', 1)]).run, APP_IMAGE)).toThrow(
      /could not read the size/i,
    );
    const problems = checkAppImageSize(
      fakeRunner([size('abc')]).run,
      () => undefined,
    );
    expect(problems.join('\n')).toMatch(/could not read the size/i);
  });
});
