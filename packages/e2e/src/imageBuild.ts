import { runMinikube } from './minikubeArgs';
import { CommandResult, Runner } from './runner';

export const APP_IMAGE = 'guardrails-app:local';
export const SERVER_IMAGE = 'guardrails-server:local';
/** The size limit of the app image, the same as the app-image job (NFR1.8). */
export const MAX_APP_IMAGE_MB = 550;

export interface ImageSpec {
  tag: string;
  dockerfile: string;
}

export const IMAGES: ImageSpec[] = [
  { tag: APP_IMAGE, dockerfile: 'packages/backend/Dockerfile' },
  { tag: SERVER_IMAGE, dockerfile: 'packages/guardrails-server/Dockerfile' },
];

const failure = (what: string, result: CommandResult): string =>
  `${what} failed (exit ${result.status ?? 'none'}${result.error ? `, ${result.error}` : ''})${result.stderr.trim() ? `: ${result.stderr.trim()}` : ' (its output is above)'}`;

function build(run: Runner, root: string, image: ImageSpec, log: Log): void {
  const options = { cwd: root, inherit: true };
  const first = runMinikube(
    run,
    ['image', 'build', '-t', image.tag, '-f', image.dockerfile, '.'],
    options,
  );
  if (first.status === 0 && !first.error) return;
  log(
    `The build of ${image.tag} inside the cluster failed; falling back to a build with the host's Docker, then loading it into the cluster.`,
  );
  const host = run(
    'docker',
    ['build', '-f', image.dockerfile, '-t', image.tag, '.'],
    options,
  );
  if (host.status !== 0 || host.error) {
    throw new Error(
      `Could not build ${image.tag}. ${failure('minikube image build', first)}. ${failure('docker build', host)}.`,
    );
  }
  const load = runMinikube(run, ['image', 'load', image.tag]);
  if (load.status !== 0 || load.error) {
    throw new Error(
      `Built ${image.tag} with Docker but could not load it into the cluster: ${failure('minikube image load', load)}.`,
    );
  }
}

type Log = (message: string) => void;

/**
 * Builds both images into the cluster's own image store from the repository
 * root, so nothing is pulled and nothing is pushed (NFR2.28, NFR5.18). The
 * Backstage frontend build can run out of memory in a 4096 MB node; then the
 * host's Docker builds the image and `minikube image load` copies it in.
 */
export function buildImages(run: Runner, root: string, log: Log): void {
  for (const image of IMAGES) {
    build(run, root, image, log);
  }
}

const isRoot = (user: string) => user === '' || /^(root|0)(:|$)/.test(user);

/** Reads the configuration of an image in the node: a non-root user, one port (NFR5.15). */
export function checkImageConfig(run: Runner, tag: string): string[] {
  const result = runMinikube(run, [
    'ssh',
    '--',
    'docker',
    'image',
    'inspect',
    tag,
  ]);
  let config: { User?: string; ExposedPorts?: Record<string, unknown> };
  try {
    if (result.status !== 0 || result.error) throw new Error(result.stderr);
    config = JSON.parse(result.stdout)[0].Config;
    if (!config) throw new Error('no Config');
  } catch (error) {
    return [
      `NFR5.15: could not read the configuration of ${tag} (${result.error ?? (result.stderr.trim() || (error as Error).message)}).`,
    ];
  }
  const problems: string[] = [];
  if (isRoot(config.User ?? '')) {
    problems.push(`NFR5.15: ${tag} must run as a non-root user.`);
  }
  const ports = Object.keys(config.ExposedPorts ?? {}).length;
  if (ports !== 1) {
    problems.push(
      `NFR5.15: ${tag} must expose exactly one exposed port, found ${ports}.`,
    );
  }
  return problems;
}

/**
 * The file-system size of an image in MB, measured as the app-image job does
 * (a `du` run inside the image, not a size column), through the node.
 */
export function imageSizeMb(run: Runner, tag: string): number {
  const result = runMinikube(run, [
    'ssh',
    '--',
    `docker run --rm --user 0 --entrypoint sh ${tag} -c 'du -sxm / 2>/dev/null | cut -f1'`,
  ]);
  const mb = Number(result.stdout.trim());
  if (result.status !== 0 || result.error || !Number.isInteger(mb)) {
    throw new Error(
      `Could not read the size of ${tag} (${result.error ?? (result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`)}).`,
    );
  }
  return mb;
}

/** Prints the app image size and requires at most 550 MB (NFR1.8). */
export function checkAppImageSize(run: Runner, log: Log): string[] {
  let mb: number;
  try {
    mb = imageSizeMb(run, APP_IMAGE);
  } catch (error) {
    return [`NFR1.8: ${(error as Error).message}`];
  }
  log(`${APP_IMAGE} size: ${mb} MB (limit ${MAX_APP_IMAGE_MB} MB)`);
  return mb > MAX_APP_IMAGE_MB
    ? [
        `NFR1.8: ${APP_IMAGE} is ${mb} MB, over the limit of ${MAX_APP_IMAGE_MB} MB.`,
      ]
    : [];
}
