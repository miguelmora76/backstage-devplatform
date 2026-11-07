import { createApp, type App } from './app';
import { generateDataSet } from './generator';
import { createLogger, type Logger } from './logger';
import { readSettings } from './settings';

export interface RunOptions {
  env: Readonly<Record<string, string | undefined>>;
  logger?: Logger;
  /** Where the one stop sentence goes (standard output by default). */
  writeLine?: (line: string) => void;
  /** The address to bind; all interfaces by default. */
  host?: string;
}

export type RunResult = { exitCode: 0; app: App } | { exitCode: 1 };

/**
 * Start-up order (W1): read and validate the settings, build the data set,
 * build the server, open the port, and only when the port reports that it is
 * listening set the ready flag and write the start line. An invalid setting
 * writes one fixed sentence and gives a non-zero exit code before anything
 * else happens (NFR5.4, NFR7.6).
 */
export async function run(options: RunOptions): Promise<RunResult> {
  const writeLine =
    options.writeLine ?? ((line: string) => process.stdout.write(`${line}\n`));
  const logger = options.logger ?? createLogger();

  const read = readSettings(options.env);
  if (!read.ok) {
    writeLine(read.message);
    return { exitCode: 1 };
  }
  const { settings } = read;

  const app = createApp({
    dataSet: generateDataSet(settings.seed),
    failureMode: settings.failureMode === 'on',
    logger,
    onListening: () => logger.start(settings),
  });
  try {
    await app.listen(settings.port, options.host);
  } catch {
    writeLine('Could not listen on the configured port.');
    return { exitCode: 1 };
  }
  return { exitCode: 0, app };
}
