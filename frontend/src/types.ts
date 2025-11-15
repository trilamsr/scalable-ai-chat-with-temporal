import { ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';
import { Socket } from 'socket.io-client';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface ChatWindowProps {
  socket: TypedSocket;
  windowId: number;
  username: string;
  color: string;
  roomId: string;
}
