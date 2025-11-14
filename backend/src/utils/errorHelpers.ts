import { ILogger } from '@chat-app/shared';

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Unified error handler for Redis operations
 * @param logger - Logger instance to use
 * @param error - Error that occurred
 * @param context - Additional context for logging
 * @param message - Error message
 * @param shouldThrow - Whether to re-throw the error
 */
export function handleRedisError(
  logger: ILogger,
  error: unknown,
  context: Record<string, any>,
  message: string,
  shouldThrow = true
): void {
  logger.error(
    { error: getErrorMessage(error), ...context },
    message
  );
  if (shouldThrow) {
    throw error;
  }
}
