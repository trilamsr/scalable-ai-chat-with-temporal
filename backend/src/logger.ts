import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Create and configure Pino logger
 * - Pretty-printed logs in development
 * - JSON logs in production
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
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

export default logger;

/**
 * Create a child logger with additional context
 * @param context Additional context to include in all logs
 */
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};
