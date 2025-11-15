import pino from 'pino';
import { getLogLevel, isDevelopmentEnv, baseLoggerOptions } from './logger.config';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
const isNode = typeof process !== 'undefined' &&
  typeof (process as any).versions !== 'undefined' &&
  typeof (process as any).versions.node !== 'undefined';
const isBrowser = typeof globalThis !== 'undefined' && typeof (globalThis as any).window !== 'undefined';
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */

const getEnvVar = (key: string): string | undefined => {
  if (isNode) {
    return process.env[key];
  }
  if (isBrowser) {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key];
    }

    if (typeof process !== 'undefined' && (process as any).env) {
      return (process as any).env[key];
    }
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  }
  return undefined;
};

const nodeEnv = getEnvVar('NODE_ENV');
const logLevelEnv = getEnvVar('LOG_LEVEL') || getEnvVar('REACT_APP_LOG_LEVEL');

const isDevelopment = isDevelopmentEnv(nodeEnv);
const logLevel = getLogLevel(logLevelEnv, isDevelopment);

const createLogger = () => {
  if (isNode) {

    return pino({
      level: logLevel,
      ...baseLoggerOptions,
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
    });
  } else if (isBrowser) {

    return pino({
      level: logLevel,
      ...baseLoggerOptions,
      browser: {
        asObject: true,
      },
    });
  } else {

    return pino({
      level: 'info',
    });
  }
};

const logger = createLogger();

export default logger;

export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

