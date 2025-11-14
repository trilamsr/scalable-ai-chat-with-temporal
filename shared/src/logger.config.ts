/**
 * Shared logger configuration
 * Common settings for both Node.js (backend) and Browser (frontend) loggers
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface BaseLoggerConfig {
  level: LogLevel;
  isDevelopment: boolean;
}

/**
 * Get the appropriate log level based on environment
 */
export const getLogLevel = (envLevel?: string, isDevelopment?: boolean): LogLevel => {
  if (envLevel) {
    return envLevel as LogLevel;
  }
  return isDevelopment ? 'debug' : 'info';
};

/**
 * Check if current environment is development
 */
export const isDevelopmentEnv = (nodeEnv?: string): boolean => {
  return nodeEnv !== 'production';
};

/**
 * Common logger options
 */
export const baseLoggerOptions = {
  // Common formatting options
  messageKey: 'msg',
  errorKey: 'err',

  // Timestamp format
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};
