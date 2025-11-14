import pino, { Logger } from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Create and configure Pino logger for browser
 * - Logs to browser console with colored output in development
 * - Structured JSON logging in production
 */
const logger: Logger = pino({
  level: process.env.REACT_APP_LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  browser: {
    asObject: true,
    serialize: true,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  },
});

export default logger;

/**
 * Create a child logger with additional context
 * @param context Additional context to include in all logs
 * @returns Child logger instance
 */
export const createChildLogger = (context: Record<string, unknown>): Logger => {
  return logger.child(context);
};
