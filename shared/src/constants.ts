/**
 * Shared constants used across frontend and backend
 *
 * Usage annotations:
 * [B] = Backend only
 * [F] = Frontend only
 * [B+F] = Both backend and frontend
 */

// Chat configuration [B+F]
export const CHAT_CONFIG = {
  HISTORY_REQUEST_COUNT: 50,                   // [F] useChatMessages.ts - number of messages to request from server
  DEFAULT_MESSAGE_COUNT: 50,                   // [B] chatHistory.ts - default count for getRecentMessages()
  MAX_HISTORY_LENGTH: 1000,                    // [B] chatHistory.ts - max messages to keep in Redis stream
  TYPING_INDICATOR_TIMEOUT: 1000,              // [F] useTypingIndicator.ts - debounce timeout for typing indicator
} as const;

// System user configuration [F]
export const SYSTEM_USER = {
  USERNAME: 'System',                          // [F] messageHelpers.ts - username for system messages
  USER_ID: 'system',                           // [F] messageHelpers.ts - user ID for system messages
} as const;

// AI Assistant configuration [B+F]
export const AI_USER = {
  USERNAME: 'AI Assistant',                    // [B] AIStreamManager.ts [F] useAIStream.ts - username for AI messages
  USER_ID: 'ai',                               // [B] AIStreamManager.ts [F] useAIStream.ts - user ID for AI messages
} as const;

// AI System Prompt [B]
export const AI_SYSTEM_PROMPT = 'You are a helpful assistant in a chat room. Be concise and friendly.'; // [B] AIStreamManager.ts - system prompt for AI

// AI Model Configuration [B]
export const AI_CONFIG = {
  DEFAULT_MODEL: 'gpt-4o-mini',                // [B] AIService.ts - default OpenAI model
  DEFAULT_TEMPERATURE: 0.7,                    // [B] aiActivities.ts - controls randomness (0-2)
  DEFAULT_MAX_TOKENS: 1000,                    // [B] aiActivities.ts - maximum tokens in response
  MAX_CONCURRENT_ACTIVITIES: 5,                // [B] worker.ts - limit concurrent AI streaming
  MAX_CONCURRENT_WORKFLOWS: 100,               // [B] worker.ts - limit concurrent workflow executions
} as const;

// Redis configuration [B]
export const REDIS_KEYS = {
  CHAT_MESSAGES: 'chat:messages',              // [B] chatHistory.ts - Redis stream key prefix for chat messages
  STREAM_CHECKPOINT: 'stream:checkpoint',      // [B] Reserved for future stream resumption feature
} as const;

export const REDIS_RETRY = {
  INITIAL_DELAY_MS: 50,                        // [B] redis.ts - initial retry delay
  MAX_DELAY_MS: 2000,                          // [B] redis.ts - maximum retry delay
} as const;

// Server defaults [B+F]
export const SERVER_DEFAULTS = {
  PORT: 4000,                                  // [B] server.ts - default backend port
  CORS_ORIGIN: 'http://localhost:3000',        // [B] server.ts - default CORS origin
  BACKEND_URL: 'http://localhost:4000',        // [F] App.tsx - default backend URL for socket connection
} as const;

// Socket.IO Configuration [B]
export const SOCKET_CONFIG = {
  PING_TIMEOUT: 60000,                         // [B] server.ts - 60 seconds - time to wait for pong response
  PING_INTERVAL: 25000,                        // [B] server.ts - 25 seconds - interval between ping packets
  CONNECT_TIMEOUT: 45000,                      // [B] server.ts - 45 seconds - connection timeout
  ACK_TIMEOUT: 10000,                          // [B] handlers - 10 seconds - acknowledgement timeout
} as const;

// AI Stream session timeouts [B]
export const AI_STREAM_TIMEOUTS = {
  SESSION_CLEANUP_MS: 60000,                  // [B] AIStreamManager.ts - 1 minute - keep completed session for reconnecting clients
  STALE_SESSION_CLEANUP_INTERVAL_MS: 300000,  // [B] AIStreamManager.ts - 5 minutes - cleanup check interval
  STALE_SESSION_THRESHOLD_MS: 600000,         // [B] AIStreamManager.ts - 10 minutes - session considered stale after this
} as const;

// Graceful shutdown timeout [B]
export const SHUTDOWN_TIMEOUT_MS = 10000;     // [B] server.ts - 10 seconds - force shutdown if graceful shutdown takes too long

// Validation limits [B+F]
// Used by validation.ts for schema definitions
// These limits are enforced on both client and server
export const VALIDATION_LIMITS = {
  USERNAME_MIN_LENGTH: 1,
  USERNAME_MAX_LENGTH: 50,
  MESSAGE_MIN_LENGTH: 1,
  MESSAGE_MAX_LENGTH: 5000,
  ROOM_ID_MIN_LENGTH: 1,
  ROOM_ID_MAX_LENGTH: 100,
} as const;
