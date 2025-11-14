/**
 * Centralized Pino logger initialization
 * Automatically detects Node.js vs Browser environment and configures accordingly
 * Backend and Frontend simply import and use this logger
 */

import pino from 'pino';
import { getLogLevel, isDevelopmentEnv, baseLoggerOptions } from './logger.config';

// Detect environment
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const isBrowser = typeof globalThis !== 'undefined' && typeof (globalThis as any).window !== 'undefined';

// Get environment variables (works in both Node and Browser)
const getEnvVar = (key: string): string | undefined => {
  if (isNode) {
    return process.env[key];
  }
  if (isBrowser) {
    // In browser, React apps use REACT_APP_ prefix
    return (process.env as any)[key];
  }
  return undefined;
};

const nodeEnv = getEnvVar('NODE_ENV');
const logLevelEnv = getEnvVar('LOG_LEVEL') || getEnvVar('REACT_APP_LOG_LEVEL');

const isDevelopment = isDevelopmentEnv(nodeEnv);
const logLevel = getLogLevel(logLevelEnv, isDevelopment);

/**
 * Initialize Pino logger based on environment
 */
const createLogger = () => {
  if (isNode) {
    // Node.js (Backend) configuration
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
    // Browser (Frontend) configuration
    return pino({
      level: logLevel,
      ...baseLoggerOptions,
      browser: {
        asObject: true,
      },
    });
  } else {
    // Fallback for unknown environments
    return pino({
      level: 'info',
    });
  }
};

// Initialize the logger
const logger = createLogger();

export default logger;

/**
 * Create a child logger with additional context
 * @param context Additional context to include in all logs
 */
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};
