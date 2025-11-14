export const REDIS_KEYS = {
  CHAT_MESSAGES: 'chat:messages',
} as const;

export const CHAT_HISTORY = {
  DEFAULT_MESSAGE_COUNT: 50,
  MAX_HISTORY_LENGTH: 1000,
} as const;

export const REDIS_RETRY = {
  INITIAL_DELAY_MS: 50,
  MAX_DELAY_MS: 2000,
} as const;

export const DEFAULT_PORT = 4000;
export const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';
