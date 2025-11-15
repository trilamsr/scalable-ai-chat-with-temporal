export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface BaseLoggerConfig {
  level: LogLevel;
  isDevelopment: boolean;
}

export const getLogLevel = (envLevel?: string, isDevelopment?: boolean): LogLevel => {
  if (envLevel) {
    return envLevel as LogLevel;
  }
  return isDevelopment ? 'debug' : 'info';
};

export const isDevelopmentEnv = (nodeEnv?: string): boolean => {
  return nodeEnv !== 'production';
};

export const baseLoggerOptions = {

  messageKey: 'msg',
  errorKey: 'err',

  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

