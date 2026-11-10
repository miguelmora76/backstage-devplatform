import { realRunner } from '../../src/runner';
import {
  createStackControl,
  stackKind,
  StackControl,
} from '../../src/stackControl';

// Control of the guardrails server of the running sample, for the one flow
// that needs it to be down (a failed change that is retried). The calls are
// built by src/stackControl.ts for the stack named by E2E_STACK: the compose run
// (the default, today's docker calls) or minikube (kubectl against the
// local minikube context only). This file only chooses the backend.
const root = process.cwd().replace(/\/packages\/e2e$/, '');

function control(): StackControl {
  return createStackControl(stackKind(process.env.E2E_STACK), {
    run: realRunner,
    root,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    now: () => Date.now(),
  });
}

/** What to end, read before it is ended: a container id or a pod name. */
export function containerId(service: string): string {
  return control().find(service);
}

/** Ends the server at once; it stays down until startService is called. */
export function killContainer(id: string): void {
  control().end(id);
}

export async function startService(service: string): Promise<void> {
  await control().start(service);
}
