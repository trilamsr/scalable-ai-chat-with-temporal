export interface ILogger {
  info(msg: string): void;
  info(obj: object, msg: string): void;
  debug(msg: string): void;
  debug(obj: object, msg: string): void;
  warn(msg: string): void;
  warn(obj: object, msg: string): void;
  error(msg: string): void;
  error(obj: object, msg: string): void;
  child(bindings: Record<string, unknown>): ILogger;
}

export interface LoggerConfig {
  level?: string;
  isDevelopment?: boolean;
}
