// `yarn minikube:up`: see src/minikubeCommands.ts.
import { load, main, root } from './common.mjs';

await main(async () => {
  const { minikubeUp, realMinikubeDeps } = await load('minikubeCommands');
  await minikubeUp(realMinikubeDeps(root, console.log));
});
