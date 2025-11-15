/**
 * Broadcast helper utilities for Socket.IO
 */

import { Server } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';
import { ServiceContainer } from '../services/ServiceContainer';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Broadcast the users list to all clients in a specific room
 * @param io - Socket.IO server instance
 * @param services - Service container with user manager
 * @param roomId - Room to broadcast to
 */
export function broadcastUsersList(
  io: TypedServer,
  services: ServiceContainer,
  roomId: string
): void {
  const usersList = services.userManager.getUsersList(roomId);
  io.to(roomId).emit('users_list', usersList);
}
