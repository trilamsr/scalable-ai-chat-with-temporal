import { Server, Socket } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
