import { ChatHistoryService } from '../chatHistory.js';
import { UserManager } from '../UserManager.js';
import { MessageService } from './MessageService.js';
import { AIService } from './AIService.js';
import { AIStreamManager } from './AIStreamManager.js';
import { createChildLogger } from '@chat-app/shared';

const containerLogger = createChildLogger({ module: 'service-container' });

/**
 * Service container for dependency injection
 *
 * Uses Singleton pattern to ensure a single instance of all services
 * throughout the application lifecycle. This provides:
 * - Centralized service management
 * - Consistent dependency injection
 * - Easy testing via reset()
 *
 * All services should be accessed through this container, not instantiated directly.
 */
export class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  public readonly userManager: UserManager;
  public readonly chatHistory: ChatHistoryService;
  public readonly messageService: MessageService;
  public readonly aiService: AIService;
  public readonly aiStreamManager: AIStreamManager;

  private constructor() {
    containerLogger.info('Initializing service container');

    // Initialize services in dependency order
    this.userManager = new UserManager();
    this.chatHistory = new ChatHistoryService();
    this.aiService = new AIService();
    this.aiStreamManager = new AIStreamManager(this.aiService, this.chatHistory);

    // Initialize services that depend on others
    this.messageService = new MessageService(this.chatHistory, this.userManager);

    containerLogger.info('Service container initialized');
  }

  /**
   * Get the singleton service container instance
   * Creates the instance on first call (lazy initialization)
   * @returns Service container instance
   */
  public static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * Reset the service container (useful for testing)
   * Clears the singleton instance, forcing a new one on next getInstance()
   */
  public static reset(): void {
    containerLogger.info('Resetting service container');
    ServiceContainer.instance = null;
  }

  /**
   * Perform cleanup on all services
   */
  public async cleanup(): Promise<void> {
    containerLogger.info('Cleaning up service container');
    this.aiStreamManager.shutdown();
    // Add any cleanup logic for services here
    // e.g., closing connections, flushing buffers, etc.
  }
}
