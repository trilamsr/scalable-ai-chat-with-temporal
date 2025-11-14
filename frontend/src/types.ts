import { Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';

// Type-safe Socket.IO client
export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Frontend-specific component props
export interface ChatWindowProps {
  socket: TypedSocket;
  windowId: number;
  username: string;
  color: string;
}
