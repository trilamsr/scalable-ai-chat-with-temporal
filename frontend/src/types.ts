// Frontend-specific component props
export interface ChatWindowProps {
  socket: any; // Socket from socket.io-client
  windowId: number;
  username: string;
  color: string;
}
