// `yarn minikube:down`: see src/minikubeCommands.ts.
import { load, main, root } from './common.mjs';

await main(async () => {
  const { minikubeDown, realMinikubeDeps } = await load('minikubeCommands');
  await minikubeDown(realMinikubeDeps(root, console.log));
});
