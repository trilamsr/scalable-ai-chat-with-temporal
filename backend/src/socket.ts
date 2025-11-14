import { Server, Socket } from 'socket.io';
import { createChildLogger } from './logger';

// Store connected users
const connectedUsers = new Map<string, string>();

// Create a logger for socket events
const socketLogger = createChildLogger({ module: 'socket' });

interface MessageData {
  text: string;
}

interface UserJoinedPayload {
  username: string;
  userId: string;
  timestamp: string;
}

interface UserLeftPayload {
  username: string;
  userId: string;
  timestamp: string;
}

interface Message {
  id: string;
  username: string;
  userId: string;
  text: string;
  timestamp: string;
}

interface UserTypingPayload {
  username: string;
  userId: string;
  isTyping: boolean;
}

interface UserInfo {
  id: string;
  name: string;
}

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
 * Create socket event handlers with access to socket and io instances
 */
export const createSocketHandlers = (io: Server, socket: Socket) => {
  const onJoin = (username: string): void => {
    connectedUsers.set(socket.id, username);
    socketLogger.info(
      { username, socketId: socket.id, totalUsers: connectedUsers.size },
      'User joined'
    );

    // Broadcast to all clients that a new user joined
    const payload: UserJoinedPayload = {
      username,
      userId: socket.id,
      timestamp: new Date().toISOString(),
    };
    io.emit('user_joined', payload);

    // Send current users list
    const usersList = getUsersList();
    io.emit('users_list', usersList);
  };

  const onSendMessage = (data: MessageData): void => {
    const username = connectedUsers.get(socket.id) || 'Anonymous';

    const message: Message = {
      id: `${Date.now()}-${socket.id}`,
      username,
      userId: socket.id,
      text: data.text,
      timestamp: new Date().toISOString(),
    };

    socketLogger.info(
      { messageId: message.id, username, socketId: socket.id, textLength: data.text.length },
      'Message received'
    );

    // Broadcast message to all connected clients
    io.emit('receive_message', message);
  };

  const onTyping = (isTyping: boolean): void => {
    const username = connectedUsers.get(socket.id);
    if (username) {
      socketLogger.debug(
        { username, socketId: socket.id, isTyping },
        'User typing status'
      );
      const payload: UserTypingPayload = {
        username,
        userId: socket.id,
        isTyping,
      };
      socket.broadcast.emit('user_typing', payload);
    }
  };

  const onDisconnect = (): void => {
    const username = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);

    socketLogger.info(
      { username, socketId: socket.id, totalUsers: connectedUsers.size },
      'User disconnected'
    );

    if (username) {
      const payload: UserLeftPayload = {
        username,
        userId: socket.id,
        timestamp: new Date().toISOString(),
      };
      io.emit('user_left', payload);
    }

    // Send updated users list
    const usersList = getUsersList();
    io.emit('users_list', usersList);
  };

  return {
    onJoin,
    onSendMessage,
    onTyping,
    onDisconnect,
  };
};

/**
 * Initialize socket connection handlers
 */
export const initializeSocket = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    socketLogger.info({ socketId: socket.id }, 'New client connected');

    const handlers = createSocketHandlers(io, socket);

    socket.on('join', handlers.onJoin);
    socket.on('send_message', handlers.onSendMessage);
    socket.on('typing', handlers.onTyping);
    socket.on('disconnect', handlers.onDisconnect);
  });
};

/**
 * Get count of connected users
 */
export const getConnectedUsersCount = (): number => {
  return connectedUsers.size;
};
