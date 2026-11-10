import { join } from 'node:path';
import { OUTPUT_FOLDERS } from './e2eRun';
import {
  checkClosed,
  checkExposure,
  Connect,
  firstNonLoopbackIPv4,
  realConnect,
} from './exposureCheck';
import { checkAppImageSize, checkImageConfig, IMAGES } from './imageBuild';
import { runKubectl } from './minikubeArgs';
import { SECRET_NAME } from './dbSecret';
import { checkRestarts } from './restartCheck';
import { realRunner, Runner } from './runner';
import { scanOutputs } from './scanOutputs';

export interface ChecksDeps {
  run: Runner;
  root: string;
  log: (message: string) => void;
  connect: Connect;
  /** The address to test for exposure; undefined when none was found. */
  address: string | undefined;
}

export function realChecksDeps(
  root: string,
  log: (message: string) => void,
): ChecksDeps {
  return {
    run: realRunner,
    root,
    log,
    connect: realConnect,
    address: firstNonLoopbackIPv4(),
  };
}

function readPassword(deps: ChecksDeps): string | undefined {
  const result = runKubectl(deps.run, [
    'get',
    'secret',
    SECRET_NAME,
    '-o',
    'jsonpath={.data.POSTGRES_PASSWORD}',
  ]);
  if (result.status !== 0 || result.error || !result.stdout.trim()) {
    return undefined;
  }
  return Buffer.from(result.stdout.trim(), 'base64').toString('utf8');
}

function podLogs(deps: ChecksDeps): Record<string, string> {
  const names = runKubectl(deps.run, ['get', 'pods', '-o', 'name']);
  const texts: Record<string, string> = {};
  for (const name of names.stdout.split('\n').filter(Boolean)) {
    const logs = runKubectl(deps.run, ['logs', name, '--all-containers=true']);
    texts[`${name} log`] = `${logs.stdout}${logs.stderr}`;
  }
  return texts;
}

function finish(deps: ChecksDeps, problems: string[], passed: string): void {
  if (problems.length > 0) {
    problems.forEach(problem => deps.log(problem));
    throw new Error(
      `${problems.length} check(s) failed:\n${problems.join('\n')}`,
    );
  }
  deps.log(passed);
}

/**
 * `yarn e2e minikube-checks`: the port answers on loopback only (NFR5.13),
 * both images run as a non-root user with one port and the app image is within
 * its size (NFR5.15, NFR1.8), no pod restarted (NFR1.6), and no password or
 * token reached the pod logs or the report (NFR5.14).
 */
export async function runMinikubeChecks(deps: ChecksDeps): Promise<void> {
  const problems: string[] = [];

  problems.push(...(await checkExposure(deps.connect, deps.address)));

  for (const image of IMAGES) {
    problems.push(...checkImageConfig(deps.run, image.tag));
  }
  problems.push(...checkAppImageSize(deps.run, deps.log));

  const pods = runKubectl(deps.run, ['get', 'pods', '-o', 'json']);
  try {
    if (pods.status !== 0 || pods.error) throw new Error(pods.stderr);
    problems.push(...checkRestarts(pods.stdout));
  } catch (error) {
    problems.push(`NFR1.6: ${(error as Error).message.trim()}`);
  }

  const password = readPassword(deps);
  if (password === undefined) {
    problems.push(
      `NFR5.14: could not read the database Secret ${SECRET_NAME}, so the output scan cannot look for the password.`,
    );
  }
  const hits = scanOutputs({
    folders: OUTPUT_FOLDERS.map(folder =>
      join(deps.root, 'packages', 'e2e', folder),
    ),
    texts: podLogs(deps),
    secrets: password === undefined ? [] : [password],
  });
  for (const hit of hits) {
    problems.push(`NFR5.14: ${hit.kind} found in ${hit.where}.`);
  }

  finish(
    deps,
    problems,
    'Exposure, images, restarts and output scan: all passed.',
  );
}

/** `yarn e2e minikube-closed`: run after `minikube:down` (NFR5.22). */
export async function runClosedCheck(deps: ChecksDeps): Promise<void> {
  finish(
    deps,
    await checkClosed(deps.connect),
    'Port 7007 is closed on 127.0.0.1.',
  );
}
