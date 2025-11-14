import { useState, useEffect } from 'react';
import { ILogger } from '@chat-app/shared';
import { TypedSocket } from '../types';
import { registerSocketEvents, unregisterSocketEvents } from '../utils/socketHelpers';

/**
 * Hook for managing socket connection lifecycle
 * Handles connect/disconnect events and user join with room support
 */
export interface UseSocketConnectionResult {
  isConnected: boolean;
}

export function useSocketConnection(
  socket: TypedSocket,
  username: string,
  roomId: string,
  logger: ILogger,
  onConnect?: () => void
): UseSocketConnectionResult {
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      logger.info({ roomId }, 'Connected to server, joining room');
      socket.emit('join', username, roomId);
      onConnect?.();
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      logger.warn('Disconnected from server');
    };

    const eventMap = {
      connect: handleConnect,
      disconnect: handleDisconnect,
    };

    registerSocketEvents(socket, eventMap);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      unregisterSocketEvents(socket, eventMap);
    };
  }, [socket, username, roomId, logger, onConnect]);

  return { isConnected };
}
