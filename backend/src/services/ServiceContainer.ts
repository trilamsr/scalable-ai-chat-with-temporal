import { ChatHistoryService } from '../chatHistory.js';
import { UserManager } from '../UserManager.js';
import { MessageService } from './MessageService.js';
import { AIService } from './AIService.js';
import { AIStreamManager } from './AIStreamManager.js';
import { createChildLogger } from '@chat-app/shared';
import { Client } from '@temporalio/client';

const logger = createChildLogger({ module: 'service-container' });

export class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  public readonly userManager: UserManager;
  public readonly chatHistory: ChatHistoryService;
  public readonly messageService: MessageService;
  public readonly aiService: AIService;
  public readonly aiStreamManager: AIStreamManager;
  public temporalClient: Client | null = null;

  private constructor() {
    logger.info('Initializing service container');

    this.userManager = new UserManager();
    this.chatHistory = new ChatHistoryService();
    this.aiService = new AIService();
    this.aiStreamManager = new AIStreamManager(); 

    this.messageService = new MessageService(this.chatHistory, this.userManager);

    logger.info('Service container initialized');
  }

  public static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  public setTemporalClient(client: Client): void {
    this.temporalClient = client;
    logger.info('Temporal client registered with service container');
  }

  public static reset(): void {
    logger.info('Resetting service container');
    ServiceContainer.instance = null;
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up service container');
    this.aiStreamManager.shutdown();

  }
}

