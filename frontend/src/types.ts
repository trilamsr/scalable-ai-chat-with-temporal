import { Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface ChatWindowProps {
  socket: TypedSocket;
  windowId: number;
  username: string;
  color: string;
  roomId: string;
}
