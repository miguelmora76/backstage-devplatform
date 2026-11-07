import { run } from './run';

/** Starts the server from the environment; stops the process on a bad setting. */
export async function main(): Promise<void> {
  const result = await run({ env: process.env });
  if (result.exitCode === 1) {
    process.exit(1);
  }
  const stop = () => {
    void result.app.close().then(() => process.exit(0));
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

if (require.main === module) {
  void main();
}
