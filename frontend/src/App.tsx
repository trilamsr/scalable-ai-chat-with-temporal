import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import ChatWindow from './components/ChatWindow';
import { logger } from '@chat-app/shared';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

interface UserConfig {
  username: string;
  color: string;
}

const App: React.FC = () => {
  const [sockets, setSockets] = useState<Socket[]>([]);
  const [userConfigs] = useState<UserConfig[]>([
    { username: 'User-Blue', color: '#3b82f6' },
    { username: 'User-Green', color: '#10b981' },
    { username: 'User-Purple', color: '#8b5cf6' }
  ]);

  useEffect(() => {
    logger.info({ backendUrl: BACKEND_URL, socketCount: userConfigs.length }, 'Initializing socket connections');

    // Create 3 separate socket connections
    const newSockets = userConfigs.map((config, index) => {
      const socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      logger.debug({ username: config.username, windowId: index + 1 }, 'Socket created');

      return socket;
    });

    setSockets(newSockets);

    // Cleanup on unmount
    return () => {
      logger.info({ socketCount: newSockets.length }, 'Disconnecting all sockets');
      newSockets.forEach((socket, index) => {
        logger.debug({ username: userConfigs[index].username }, 'Disconnecting socket');
        socket.disconnect();
      });
    };
  }, [userConfigs]);

  return (
    <div className="min-h-screen p-5">
      <header className="text-center text-white mb-8 p-5">
        <h1 className="text-4xl font-bold mb-2 drop-shadow-lg">
          Multi-Window Chat Application
        </h1>
        <p className="text-lg opacity-90">
          Three independent chat clients connected to the same WebSocket server
        </p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 max-w-[1800px] mx-auto">
        {sockets.map((socket, index) => (
          <ChatWindow
            key={index}
            socket={socket}
            windowId={index + 1}
            username={userConfigs[index].username}
            color={userConfigs[index].color}
          />
        ))}
      </div>
    </div>
  );
};

export default App;
