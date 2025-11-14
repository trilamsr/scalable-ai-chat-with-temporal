import { useState, useEffect } from 'react';
import { ILogger } from '@chat-app/shared';
import { TypedSocket } from '../types';
import { registerSocketEvents, unregisterSocketEvents } from '../utils/socketHelpers';

/**
 * Hook for managing socket connection lifecycle
 * Handles connect/disconnect events and user join
 */
export interface UseSocketConnectionResult {
  isConnected: boolean;
}

export function useSocketConnection(
  socket: TypedSocket,
  username: string,
  logger: ILogger,
  onConnect?: () => void
): UseSocketConnectionResult {
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      logger.info('Connected to server');
      socket.emit('join', username);
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
  }, [socket, username, logger, onConnect]);

  return { isConnected };
}
