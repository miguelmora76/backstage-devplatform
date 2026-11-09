import { COMPOSE_VERSION_ARGS } from './composeArgs';
import { Runner } from './runner';

/** Stops with a plain message when Docker or Compose v2 is missing. */
export function checkDocker(run: Runner): void {
  const docker = run('docker', ['--version']);
  if (docker.error || docker.status !== 0) {
    throw new Error(
      'Docker is not installed or not on the PATH. Install Docker and start it, then try again.',
    );
  }
  const compose = run('docker', COMPOSE_VERSION_ARGS);
  if (compose.error || compose.status !== 0) {
    throw new Error(
      'Docker Compose v2 is not available ("docker compose version" failed). Update Docker to a version that includes Compose v2.',
    );
  }
}
