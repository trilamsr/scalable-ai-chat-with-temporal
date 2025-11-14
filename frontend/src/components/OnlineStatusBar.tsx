import React from 'react';
import { UserInfo } from '@chat-app/shared';

interface OnlineStatusBarProps {
  onlineUsers: UserInfo[];
}

/**
 * Memoized OnlineStatusBar to prevent unnecessary re-renders
 */
const OnlineStatusBar: React.FC<OnlineStatusBarProps> = React.memo(({ onlineUsers }) => {
  return (
    <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 text-sm text-gray-600 flex gap-2 items-center">
      <span className="font-semibold text-gray-700">Online ({onlineUsers.length}):</span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
        {onlineUsers.map((user) => user.name).join(', ') || 'None'}
      </span>
    </div>
  );
});

OnlineStatusBar.displayName = 'OnlineStatusBar';

export default OnlineStatusBar;
