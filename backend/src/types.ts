import { ServerToClientEvents, ClientToServerEvents } from '@chat-app/shared';
import { Server, Socket } from 'socket.io';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
