import { ChatHistoryService } from '../chatHistory';
import { UserManager } from '../UserManager';
import { MessageService } from './MessageService';
import { createChildLogger } from '@chat-app/shared';

const containerLogger = createChildLogger({ module: 'service-container' });

/**
 * Service container for dependency injection
 * Manages lifecycle and dependencies of all services
 */
export class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  public readonly userManager: UserManager;
  public readonly chatHistory: ChatHistoryService;
  public readonly messageService: MessageService;

  private constructor() {
    containerLogger.info('Initializing service container');

    // Initialize services in dependency order
    this.userManager = new UserManager();
    this.chatHistory = new ChatHistoryService();

    // Initialize services that depend on others
    this.messageService = new MessageService(this.chatHistory, this.userManager);

    containerLogger.info('Service container initialized');
  }

  /**
   * Get the singleton service container instance
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
    // Add any cleanup logic for services here
    // e.g., closing connections, flushing buffers, etc.
  }
}
