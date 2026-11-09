import { posix } from 'node:path';

const EXACT_TAG = /^[\w./-]+:\d+\.\d+(\.\d+)?(-[\w.]+)?$/;

interface Instruction {
  name: string;
  args: string;
}

function instructions(text: string): Instruction[] {
  const joined = text.replace(/\\\r?\n/g, ' ');
  const list: Instruction[] = [];
  for (const raw of joined.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const space = line.search(/\s/);
    list.push(
      space < 0
        ? { name: line.toUpperCase(), args: '' }
        : {
            name: line.slice(0, space).toUpperCase(),
            args: line.slice(space).trim(),
          },
    );
  }
  return list;
}

/** The text of the last CMD: the script of a shell-form array, or the joined words. */
export function dockerfileCommand(text: string): string | undefined {
  const cmds = instructions(text).filter(i => i.name === 'CMD');
  const last = cmds[cmds.length - 1];
  if (!last) return undefined;
  try {
    const parsed = JSON.parse(last.args);
    if (Array.isArray(parsed)) {
      const isShell = parsed[0] === 'sh' && parsed[1] === '-c';
      return isShell ? String(parsed[parsed.length - 1]) : parsed.join(' ');
    }
  } catch {
    // Shell form: the arguments are the command.
  }
  return last.args;
}

/** Checks an image build file against NFR5.2 to NFR5.4. */
export function checkDockerfile(text: string): string[] {
  const list = instructions(text);
  const problems: string[] = [];
  const args = new Map<string, string>();
  for (const i of list) {
    if (i.name === 'ARG') {
      const [key, ...rest] = i.args.split('=');
      args.set(key.trim(), rest.join('='));
      if (/(PASSWORD|TOKEN|SECRET|KEY)/i.test(key)) {
        problems.push(
          `NFR5.2: ${i.name} ${key.trim()} looks like a secret in the build file.`,
        );
      }
    }
    if (
      i.name === 'ENV' &&
      /(PASSWORD|TOKEN|SECRET|KEY)\w*[= ]/i.test(i.args)
    ) {
      problems.push(
        `NFR5.2: ENV ${i.args.split(/[= ]/)[0]} looks like a secret in the build file.`,
      );
    }
  }
  const froms = list.filter(i => i.name === 'FROM');
  for (const from of froms) {
    let image = from.args.split(/\s+/)[0];
    const variable = image.match(/^\$\{(\w+)\}$/);
    const written = image;
    if (variable) image = args.get(variable[1]) ?? '';
    if (!EXACT_TAG.test(image)) {
      problems.push(
        `NFR5.4: FROM ${written} does not resolve to an exact version tag${image ? ` (${image})` : ''}.`,
      );
    }
  }
  const lastFrom = list.map(i => i.name).lastIndexOf('FROM');
  const final = list.slice(lastFrom + 1);
  const user = final.filter(i => i.name === 'USER').pop()?.args;
  if (!user || user === 'root' || user === '0') {
    problems.push('NFR5.3: the final stage needs a non-root USER.');
  }
  const exposed = final
    .filter(i => i.name === 'EXPOSE')
    .flatMap(i => i.args.split(/\s+/));
  if (exposed.length !== 1) {
    problems.push(
      `NFR5.3: the image must expose exactly one port, found ${exposed.length}.`,
    );
  }
  if (!final.some(i => i.name === 'CMD' || i.name === 'ENTRYPOINT')) {
    problems.push('NFR2.3: the final stage needs a CMD.');
  }
  return problems;
}

/** Paths under /app that COPY instructions of the final stage put in the image. */
function copiedPaths(text: string): string[] {
  const list = instructions(text);
  const lastFrom = list.map(i => i.name).lastIndexOf('FROM');
  let workdir = '/';
  const paths: string[] = [];
  for (const i of list.slice(lastFrom + 1)) {
    if (i.name === 'WORKDIR') workdir = posix.resolve(workdir, i.args);
    if (i.name !== 'COPY' && i.name !== 'ADD') continue;
    const words = i.args.split(/\s+/).filter(w => !w.startsWith('--'));
    const dest = words[words.length - 1];
    const resolved = posix.resolve(workdir, dest);
    const trailing = dest.endsWith('/') || dest === '.';
    for (const src of words.slice(0, -1)) {
      paths.push(
        trailing ? posix.join(resolved, posix.basename(src)) : resolved,
      );
    }
  }
  return paths;
}

/**
 * The files the start command and the settings name must be copied into the
 * working directory by the image build, so a missing file fails in a unit
 * test and not as an empty catalog in the end-to-end run (NFR2.3).
 */
export function checkDockerfileFiles(
  text: string,
  appConfig: string,
): string[] {
  const problems: string[] = [];
  const copied = copiedPaths(text);
  const command = dockerfileCommand(text) ?? '';
  for (const match of command.matchAll(/--config\s+(\S+)/g)) {
    const wanted = posix.resolve('/app', match[1]);
    if (!copied.includes(wanted)) {
      problems.push(
        `NFR2.3: --config ${match[1]} is not copied into /app by the image build.`,
      );
    }
  }
  const target = appConfig.match(/target:\s*(\S+)/)?.[1];
  if (target) {
    const wanted = posix.resolve('/app', target);
    const covered = copied.some(
      c => wanted === c || wanted.startsWith(`${c}/`),
    );
    if (!covered) {
      problems.push(
        `NFR2.3: the catalog target ${target} is not copied into /app (catalog folder).`,
      );
    }
  } else {
    problems.push(
      'NFR2.3: the catalog target could not be read from app-config.yaml.',
    );
  }
  return problems;
}
