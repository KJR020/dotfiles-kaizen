export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_PREFIX = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  debug: '🐛'
};

export class Logger {
  constructor(private readonly verbose: boolean = false) {}

  log(level: LogLevel, message: string, extra?: Record<string, unknown>) {
    if (level === 'debug' && !this.verbose) return;
    const prefix = LEVEL_PREFIX[level] ?? '';
    const payload = extra ? `${message} ${JSON.stringify(extra)}` : message;
    // eslint-disable-next-line no-console
    console.error(`${prefix} ${payload}`);
  }

  info(message: string, extra?: Record<string, unknown>) {
    this.log('info', message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>) {
    this.log('warn', message, extra);
  }

  error(message: string, extra?: Record<string, unknown>) {
    this.log('error', message, extra);
  }

  debug(message: string, extra?: Record<string, unknown>) {
    this.log('debug', message, extra);
  }
}

export const logger = new Logger(process.env.DEBUG?.toLowerCase() === 'true');
