function entries(text: string): Set<string> {
  return new Set(
    text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')),
  );
}

const has = (set: Set<string>, name: string) =>
  set.has(name) || set.has(`**/${name}`);

/** Checks the ignore files keep env files out of builds and out of git (NFR5.2). */
export function checkIgnoreFiles(files: {
  dockerignore: string;
  gitignore: string;
}): string[] {
  const docker = entries(files.dockerignore);
  const git = entries(files.gitignore);
  const problems: string[] = [];
  if (!docker.has('.env*')) {
    problems.push(
      'NFR5.2: .dockerignore must list .env* so env files cannot enter a build.',
    );
  }
  for (const name of ['coverage', 'dist-types']) {
    if (!has(docker, name)) {
      problems.push(`NFR1.4: .dockerignore must list ${name}.`);
    }
  }
  for (const name of ['.env', '.env.compose']) {
    if (!git.has(name)) {
      problems.push(`NFR5.2: .gitignore must list ${name}.`);
    }
  }
  return problems;
}
