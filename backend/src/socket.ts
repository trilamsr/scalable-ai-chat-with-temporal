import { Server, Socket } from 'socket.io';
import {
  createChildLogger,
  MessageData,
  Message,
  UserJoinedPayload,
  UserLeftPayload,
  UserTypingPayload,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@chat-app/shared';
import { chatHistory } from './chatHistory';
import { getErrorMessage } from './utils/errorHelpers';
import { userManager } from './UserManager';

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

  constructor(io: TypedServer, socket: TypedSocket) {
    this.io = io;
    this.socket = socket;
  }

  /**
   * Handle user joining the chat room
   */
  public onJoin = (username: string, roomId: string): void => {
    // Join the Socket.IO room
    this.socket.join(roomId);

    // Add user to manager
    userManager.addUser(this.socket.id, username, roomId);
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
    const usersList = userManager.getUsersList(roomId);
    this.io.to(roomId).emit('users_list', usersList);
  };

  /**
   * Handle incoming message
   */
  public onSendMessage = async (data: MessageData): Promise<void> => {
    const username = userManager.getUsername(this.socket.id);
    const roomId = userManager.getRoomId(this.socket.id);

    if (!roomId) {
      socketLogger.warn({ socketId: this.socket.id }, 'Message from user not in a room');
      return;
    }

    const message: Message = {
      id: `${Date.now()}-${this.socket.id}`,
      username,
      userId: this.socket.id,
      text: data.text,
      timestamp: new Date().toISOString(),
      roomId,
    };

    socketLogger.info(
      { messageId: message.id, username, socketId: this.socket.id, roomId, textLength: data.text.length },
      'Message received'
    );

    // Save message to Redis stream
    try {
      await chatHistory.addMessage(message);
    } catch (error) {
      socketLogger.error(
        { error: getErrorMessage(error), messageId: message.id },
        'Failed to save message to history'
      );
      // Continue even if history save fails
    }

    // Broadcast message to room only
    this.io.to(roomId).emit('receive_message', message);
  };

  /**
   * Handle typing indicator
   */
  public onTyping = (isTyping: boolean): void => {
    if (userManager.isUserConnected(this.socket.id)) {
      const username = userManager.getUsername(this.socket.id);
      const roomId = userManager.getRoomId(this.socket.id);

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
    const username = userManager.getUsername(this.socket.id);
    const roomId = userManager.getRoomId(this.socket.id);

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
      const messages = await chatHistory.getRecentMessages(roomId, count);
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
    const userData = userManager.removeUser(this.socket.id);

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
      const usersList = userManager.getUsersList(roomId);
      this.io.to(roomId).emit('users_list', usersList);
    } else {
      socketLogger.info({ socketId: this.socket.id }, 'User disconnected (no room data)');
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
    this.socket.on('disconnect', this.onDisconnect);
  }
}

/**
 * Initialize socket connection handlers
 */
export const initializeSocket = (io: TypedServer): void => {
  io.on('connection', (socket: TypedSocket) => {
    socketLogger.info({ socketId: socket.id }, 'New client connected');

    // Create and register handlers for this connection
    const handlers = new SocketHandlers(io, socket);
    handlers.registerHandlers();
  });
};

/**
 * Get count of connected users
 */
export const getConnectedUsersCount = (): number => {
  return userManager.getUserCount();
};
