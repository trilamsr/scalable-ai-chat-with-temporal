/**
 * Shared module exports
 * Central export point for all shared code
 */

// Export all types
export * from './types';

// Export logger interfaces and configuration
export * from './logger.interface';
export * from './logger.config';

// Export logger (pre-configured for Node.js or Browser)
export { default as logger, createChildLogger } from './logger';
