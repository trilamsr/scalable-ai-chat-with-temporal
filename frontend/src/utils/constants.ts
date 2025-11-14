export const CHAT_CONFIG = {
  HISTORY_REQUEST_COUNT: 50,
  TYPING_INDICATOR_TIMEOUT: 1000,
} as const;

export const SYSTEM_USER = {
  USERNAME: 'System',
  USER_ID: 'system',
} as const;

export const DEFAULT_BACKEND_URL = 'http://localhost:4000';
