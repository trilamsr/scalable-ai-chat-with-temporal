

import { SERVER_DEFAULTS, SOCKET_CONFIG, AI_CONFIG, REDIS_RETRY } from '@chat-app/shared';

export interface AppConfig {
  
  server: {
    port: number;
    corsOrigin: string;
    env: string;
  };

  
  socket: {
    pingTimeout: number;
    pingInterval: number;
    connectTimeout: number;
  };

  
  redis: {
    url: string;
    retryInitialDelay: number;
    retryMaxDelay: number;
  };

  
  temporal: {
    address: string;
    namespace: string;
    taskQueue: string;
  };

  
  ai: {
    apiKey: string;
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    maxConcurrentActivities: number;
    maxConcurrentWorkflows: number;
  };

  
  frontendUrl: string;
}

function loadConfig(): AppConfig {
  const config: AppConfig = {
    server: {
      port: parseInt(process.env.PORT || String(SERVER_DEFAULTS.PORT), 10),
      corsOrigin: process.env.FRONTEND_URL || SERVER_DEFAULTS.CORS_ORIGIN,
      env: process.env.NODE_ENV || 'development',
    },

    socket: {
      pingTimeout: SOCKET_CONFIG.PING_TIMEOUT,
      pingInterval: SOCKET_CONFIG.PING_INTERVAL,
      connectTimeout: SOCKET_CONFIG.CONNECT_TIMEOUT,
    },

    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retryInitialDelay: REDIS_RETRY.INITIAL_DELAY_MS,
      retryMaxDelay: REDIS_RETRY.MAX_DELAY_MS,
    },

    temporal: {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      namespace: 'default',
      taskQueue: 'ai-chat-queue',
    },

    ai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      defaultModel: AI_CONFIG.DEFAULT_MODEL,
      temperature: AI_CONFIG.DEFAULT_TEMPERATURE,
      maxTokens: AI_CONFIG.DEFAULT_MAX_TOKENS,
      maxConcurrentActivities: AI_CONFIG.MAX_CONCURRENT_ACTIVITIES,
      maxConcurrentWorkflows: AI_CONFIG.MAX_CONCURRENT_WORKFLOWS,
    },

    frontendUrl: process.env.FRONTEND_URL || SERVER_DEFAULTS.CORS_ORIGIN,
  };

  
  if (!config.ai.apiKey && config.server.env === 'production') {
    throw new Error('OPENAI_API_KEY is required in production');
  }

  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error(`Invalid PORT: ${config.server.port}`);
  }

  return config;
}

export const config: AppConfig = loadConfig();

export function isDevelopment(): boolean {
  return config.server.env === 'development';
}

export function isProduction(): boolean {
  return config.server.env === 'production';
}

export function isTest(): boolean {
  return config.server.env === 'test';
}
