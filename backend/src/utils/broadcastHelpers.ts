import { ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';
import { Server } from 'socket.io';
import { ServiceContainer } from '../services/ServiceContainer';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function broadcastUsersList(
  io: TypedServer,
  services: ServiceContainer,
  roomId: string
): void {
  const usersList = services.userManager.getUsersList(roomId);
  io.to(roomId).emit('users_list', usersList);
}
