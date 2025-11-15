import { Socket } from 'socket.io-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketEventHandler = (...args: any[]) => void;

interface SocketEventMap {
  [eventName: string]: SocketEventHandler;
}

export function registerSocketEvents(socket: Socket, eventMap: SocketEventMap): void {
  Object.entries(eventMap).forEach(([event, handler]) => {
    socket.on(event, handler);
  });
}

export function unregisterSocketEvents(socket: Socket, eventMap: SocketEventMap): void {
  Object.entries(eventMap).forEach(([event, handler]) => {
    socket.off(event, handler);
  });
}
