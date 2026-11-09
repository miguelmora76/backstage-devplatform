import { createBackend } from '@backstage/backend-defaults';
import { backendFeatures } from './features';

// Entry point (excluded from coverage: it only wires the list into Backstage).
// A failed start is loud: the message is printed and the process exits with a
// code other than 0, so the compose run shows the failure (NFR7.2).
const backend = createBackend();
for (const feature of backendFeatures) {
  backend.add(feature);
}

backend.start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`The backend could not start: ${message}`);
  process.exit(1);
});
