import {
  coreServices,
  createServiceFactory,
  type LoggerService,
  type ServiceFactory,
} from '@backstage/backend-plugin-api';

export interface RecordedLine {
  level: 'debug' | 'info' | 'warn' | 'error';
  text: string;
}

export interface LogRecorder {
  lines: RecordedLine[];
  /** All recorded lines as one text, for searching. */
  text(): string;
}

/** A root logger that records every line instead of printing it (observability design O2, O3). */
export function createRecordingLogger(): {
  recorder: LogRecorder;
  factory: ServiceFactory;
} {
  const lines: RecordedLine[] = [];
  const record =
    (level: RecordedLine['level']) => (message: string, meta?: unknown) => {
      lines.push({
        level,
        text: meta === undefined ? message : `${message} ${safe(meta)}`,
      });
    };
  const logger: LoggerService = {
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    child: () => logger,
  };
  const factory = createServiceFactory({
    service: coreServices.rootLogger,
    deps: {},
    factory: () => logger,
  });
  return {
    recorder: { lines, text: () => lines.map(line => line.text).join('\n') },
    factory,
  };
}

function safe(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, v) =>
      v instanceof Error ? { message: v.message, stack: v.stack } : v,
    );
  } catch {
    return String(value);
  }
}
