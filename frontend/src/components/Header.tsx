import React from 'react';

interface HeaderProps {
  windowId: number;
  color: string;
  isConnected: boolean;
  username: string;
  roomId: string;
  onClearHistory: () => void;
}

/**
 * Memoized Header to prevent unnecessary re-renders
 */
const Header: React.FC<HeaderProps> = React.memo(({ windowId, color, isConnected, username, roomId, onClearHistory }) => {
  return (
    <div
      className="p-4 text-white flex flex-wrap justify-between items-center gap-2"
      style={{ backgroundColor: color }}
    >
      <div className="flex flex-col">
        <h3 className="text-lg font-semibold">Room ID: {roomId}</h3>
        <span className="text-xs opacity-80">Window {windowId}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-xs px-2 py-1 bg-white bg-opacity-20 rounded-full">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse-slow' : 'bg-red-400'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        <button
          onClick={onClearHistory}
          disabled={!isConnected}
          className="text-xs px-3 py-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full font-medium transition-colors"
          title="Clear chat history"
        >
          Clear History
        </button>
      </div>
      <div className="text-xs w-full mt-1">
        Logged in as: <strong>{username}</strong>
      </div>
    </div>
  );
});

Header.displayName = 'Header';

export default Header;
