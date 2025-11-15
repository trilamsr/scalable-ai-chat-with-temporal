import { ILogger } from '@chat-app/shared';

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function handleRedisError(
  logger: ILogger,
  error: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
