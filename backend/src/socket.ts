import { Server, Socket } from 'socket.io';
import {
  createChildLogger,
  MessageData,
  Message,
  UserJoinedPayload,
  UserLeftPayload,
  UserTypingPayload,
  UserInfo,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@chat-app/shared';
import { chatHistory } from './chatHistory';

// Type-safe socket types
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Store connected users
const connectedUsers = new Map<string, string>();

// Create a logger for socket events
const socketLogger = createChildLogger({ module: 'socket' });

/**
 * Get list of all connected users
 */
const getUsersList = (): UserInfo[] => {
  return Array.from(connectedUsers.entries()).map(([id, name]) => ({
    id,
    name,
  }));
};

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
   * Handle user joining the chat
   */
  public onJoin = (username: string): void => {
    connectedUsers.set(this.socket.id, username);
    socketLogger.info(
      { username, socketId: this.socket.id, totalUsers: connectedUsers.size },
      'User joined'
    );

    // Broadcast to all clients that a new user joined
    const payload: UserJoinedPayload = {
      username,
      userId: this.socket.id,
      timestamp: new Date().toISOString(),
    };
    this.io.emit('user_joined', payload);

    // Send current users list
    const usersList = getUsersList();
    this.io.emit('users_list', usersList);
  };

  /**
   * Handle incoming message
   */
  public onSendMessage = async (data: MessageData): Promise<void> => {
    const username = connectedUsers.get(this.socket.id) || 'Anonymous';

    const message: Message = {
      id: `${Date.now()}-${this.socket.id}`,
      username,
      userId: this.socket.id,
      text: data.text,
      timestamp: new Date().toISOString(),
    };

    socketLogger.info(
      { messageId: message.id, username, socketId: this.socket.id, textLength: data.text.length },
      'Message received'
    );

    // Save message to Redis stream
    try {
      await chatHistory.addMessage(message);
    } catch (error) {
      socketLogger.error(
        { error: error instanceof Error ? error.message : 'Unknown error', messageId: message.id },
        'Failed to save message to history'
      );
      // Continue even if history save fails
    }

    // Broadcast message to all connected clients
    this.io.emit('receive_message', message);
  };

  /**
   * Handle typing indicator
   */
  public onTyping = (isTyping: boolean): void => {
    const username = connectedUsers.get(this.socket.id);
    if (username) {
      socketLogger.debug(
        { username, socketId: this.socket.id, isTyping },
        'User typing status'
      );
      const payload: UserTypingPayload = {
        username,
        userId: this.socket.id,
        isTyping,
      };
      this.socket.broadcast.emit('user_typing', payload);
    }
  };

  /**
   * Handle chat history request
   */
  public onGetHistory = async (count?: number): Promise<void> => {
    const username = connectedUsers.get(this.socket.id);
    socketLogger.info(
      { username, socketId: this.socket.id, requestedCount: count },
      'Chat history requested'
    );

    try {
      const messages = await chatHistory.getRecentMessages(count);
      this.socket.emit('chat_history', messages);
      socketLogger.debug(
        { username, socketId: this.socket.id, messagesReturned: messages.length },
        'Chat history sent'
      );
    } catch (error) {
      socketLogger.error(
        { error: error instanceof Error ? error.message : 'Unknown error', socketId: this.socket.id },
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
    const username = connectedUsers.get(this.socket.id);
    connectedUsers.delete(this.socket.id);

    socketLogger.info(
      { username, socketId: this.socket.id, totalUsers: connectedUsers.size },
      'User disconnected'
    );

    if (username) {
      const payload: UserLeftPayload = {
        username,
        userId: this.socket.id,
        timestamp: new Date().toISOString(),
      };
      this.io.emit('user_left', payload);
    }

    // Send updated users list
    const usersList = getUsersList();
    this.io.emit('users_list', usersList);
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
  return connectedUsers.size;
};
