import { Server, Socket } from 'socket.io';
import {
  createChildLogger,
  MessageData,
  MessageAck,
  UserJoinedPayload,
  UserLeftPayload,
  UserTypingPayload,
  ServerToClientEvents,
  ClientToServerEvents,
  validateData,
  usernameSchema,
  roomIdSchema,
} from '@chat-app/shared';
import { ServiceContainer } from './services/ServiceContainer';
import { getErrorMessage } from './utils/errorHelpers';

// Type-safe socket types
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Create a logger for socket events
const socketLogger = createChildLogger({ module: 'socket' });

/**
 * Socket event handlers class
 * Encapsulates all socket event handling logic for a single connection
 */
class SocketHandlers {
  private io: TypedServer;
  private socket: TypedSocket;
  private services: ServiceContainer;

  constructor(io: TypedServer, socket: TypedSocket, services: ServiceContainer) {
    this.io = io;
    this.socket = socket;
    this.services = services;
  }

  /**
   * Handle user joining the chat room
   */
  public onJoin = (
    username: string,
    roomId: string,
    callback?: (response: { success: boolean; error?: string }) => void
  ): void => {
    // Validate username
    const usernameValidation = validateData(usernameSchema, username);
    if (!usernameValidation.success) {
      socketLogger.warn({ socketId: this.socket.id, error: usernameValidation.error }, 'Invalid username');
      callback?.({ success: false, error: usernameValidation.error });
      return;
    }

    // Validate roomId
    const roomIdValidation = validateData(roomIdSchema, roomId);
    if (!roomIdValidation.success) {
      socketLogger.warn({ socketId: this.socket.id, error: roomIdValidation.error }, 'Invalid roomId');
      callback?.({ success: false, error: roomIdValidation.error });
      return;
    }

    // Join the Socket.IO room
    this.socket.join(roomId);

    // Add user to manager
    this.services.userManager.addUser(this.socket.id, username, roomId);
    socketLogger.info({ username, socketId: this.socket.id, roomId }, 'User joined room');

    // Broadcast to room that a new user joined
    const payload: UserJoinedPayload = {
      username,
      userId: this.socket.id,
      timestamp: new Date().toISOString(),
      roomId,
    };
    this.io.to(roomId).emit('user_joined', payload);

    // Send current users list for this room
    const usersList = this.services.userManager.getUsersList(roomId);
    this.io.to(roomId).emit('users_list', usersList);

    // If there's an active AI stream, send the current state to the newly joined user
    const activeSession = this.services.aiStreamManager.getSession(roomId);
    if (activeSession && activeSession.isActive) {
      socketLogger.info(
        { roomId, messageId: activeSession.messageId, username },
        'Sending active AI stream state to newly joined user'
      );

      // Send start event
      this.socket.emit('ai_stream_start', {
        messageId: activeSession.messageId,
        roomId,
        timestamp: activeSession.startedAt.toISOString(),
      });

      // Send current accumulated text as a single chunk
      if (activeSession.accumulatedText) {
        this.socket.emit('ai_stream_chunk', {
          messageId: activeSession.messageId,
          roomId,
          chunk: activeSession.accumulatedText,
          accumulatedText: activeSession.accumulatedText,
        });
      }
    }

    // Acknowledge success
    callback?.({ success: true });
  };

  /**
   * Handle incoming message with acknowledgment
   */
  public onSendMessage = async (data: MessageData, callback: (ack: MessageAck) => void): Promise<void> => {
    // Process message through service layer
    const result = await this.services.messageService.processMessage(data, this.socket.id);

    if (!result.success) {
      // Validation or processing error
      socketLogger.warn(
        { socketId: this.socket.id, error: result.error, code: result.code },
        'Message processing failed'
      );

      callback({
        success: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    const { message, ack } = result;

    // Broadcast message to room only (including sender for consistency)
    this.io.to(message.roomId).emit('receive_message', message);

    // Send acknowledgment to sender
    callback(ack);

    socketLogger.info(
      {
        messageId: message.id,
        username: message.username,
        socketId: this.socket.id,
        roomId: message.roomId,
        persisted: ack.success,
      },
      'Message processed'
    );

    // Trigger AI response if no stream is currently active
    if (!this.services.aiStreamManager.isStreamActive(message.roomId)) {
      socketLogger.info({ roomId: message.roomId }, 'Triggering AI response');

      // Get recent chat history for context
      try {
        const recentMessages = await this.services.chatHistory.getRecentMessages(message.roomId, 5);
        const conversationHistory = recentMessages
          .filter((msg) => !msg.isSystem)
          .map((msg) => msg.text);

        // Start AI streaming (non-blocking)
        this.services.aiStreamManager
          .startStream(this.io, message.roomId, message.text, conversationHistory)
          .catch((error) => {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            socketLogger.error({ error: errorMsg, roomId: message.roomId }, 'AI stream failed');
          });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        socketLogger.error({ error: errorMsg, roomId: message.roomId }, 'Failed to get chat history for AI');
      }
    }
  };

  /**
   * Handle typing indicator
   */
  public onTyping = (isTyping: boolean): void => {
    if (this.services.userManager.isUserConnected(this.socket.id)) {
      const username = this.services.userManager.getUsername(this.socket.id);
      const roomId = this.services.userManager.getRoomId(this.socket.id);

      if (!roomId) return;

      socketLogger.debug(
        { username, socketId: this.socket.id, roomId, isTyping },
        'User typing status'
      );
      const payload: UserTypingPayload = {
        username,
        userId: this.socket.id,
        isTyping,
        roomId,
      };
      // Broadcast to room only (excluding sender)
      this.socket.to(roomId).emit('user_typing', payload);
    }
  };

  /**
   * Handle chat history request
   */
  public onGetHistory = async (count?: number): Promise<void> => {
    const username = this.services.userManager.getUsername(this.socket.id);
    const roomId = this.services.userManager.getRoomId(this.socket.id);

    if (!roomId) {
      socketLogger.warn({ socketId: this.socket.id }, 'History request from user not in a room');
      this.socket.emit('chat_history', []);
      return;
    }

    socketLogger.info(
      { username, socketId: this.socket.id, roomId, requestedCount: count },
      'Chat history requested'
    );

    try {
      const messages = await this.services.chatHistory.getRecentMessages(roomId, count);
      this.socket.emit('chat_history', messages);
      socketLogger.debug(
        { username, socketId: this.socket.id, roomId, messagesReturned: messages.length },
        'Chat history sent'
      );
    } catch (error) {
      socketLogger.error(
        { error: getErrorMessage(error), socketId: this.socket.id },
        'Failed to retrieve chat history'
      );
      // Send empty array on error
      this.socket.emit('chat_history', []);
    }
  };

  /**
   * Handle user disconnection
   */
  public onDisconnect = (): void => {
    const userData = this.services.userManager.removeUser(this.socket.id);

    if (userData) {
      const { username, roomId } = userData;
      socketLogger.info({ username, socketId: this.socket.id, roomId }, 'User disconnected from room');

      const payload: UserLeftPayload = {
        username,
        userId: this.socket.id,
        timestamp: new Date().toISOString(),
        roomId,
      };
      this.io.to(roomId).emit('user_left', payload);

      // Send updated users list for this room
      const usersList = this.services.userManager.getUsersList(roomId);
      this.io.to(roomId).emit('users_list', usersList);
    } else {
      socketLogger.info({ socketId: this.socket.id }, 'User disconnected (no room data)');
    }
  };

  /**
   * Handle clear history request
   */
  public onClearHistory = async (
    roomId: string,
    callback?: (response: { success: boolean; error?: string }) => void
  ): Promise<void> => {
    const username = this.services.userManager.getUsername(this.socket.id);

    socketLogger.warn({ username, socketId: this.socket.id, roomId }, 'Clear history requested');

    try {
      await this.services.chatHistory.clearHistory(roomId);

      // Broadcast to all users in the room that history was cleared
      this.io.to(roomId).emit('chat_history', []);

      callback?.({ success: true });

      socketLogger.info({ username, socketId: this.socket.id, roomId }, 'Chat history cleared successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      socketLogger.error({ error: errorMessage, roomId }, 'Failed to clear chat history');

      callback?.({ success: false, error: 'Failed to clear history' });
    }
  };

  /**
   * Register all event handlers to the socket
   */
  public registerHandlers(): void {
    this.socket.on('join', this.onJoin);
    this.socket.on('send_message', this.onSendMessage);
    this.socket.on('typing', this.onTyping);
    this.socket.on('get_history', this.onGetHistory);
    this.socket.on('clear_history', this.onClearHistory);
    this.socket.on('disconnect', this.onDisconnect);
  }
}

/**
 * Initialize socket connection handlers with Redis adapter for horizontal scaling
 */
export const initializeSocket = (io: TypedServer, services: ServiceContainer): void => {
  io.on('connection', (socket: TypedSocket) => {
    socketLogger.info({ socketId: socket.id }, 'New client connected');

    // Create and register handlers for this connection
    const handlers = new SocketHandlers(io, socket, services);
    handlers.registerHandlers();
  });
};

/**
 * Get count of connected users
 */
export const getConnectedUsersCount = (services: ServiceContainer): number => {
  return services.userManager.getUserCount();
};
