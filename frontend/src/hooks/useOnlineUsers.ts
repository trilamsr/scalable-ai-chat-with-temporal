import { useState, useEffect } from 'react';
import { UserInfo, ILogger } from '@chat-app/shared';
import { TypedSocket } from '../types';
import { registerSocketEvents, unregisterSocketEvents } from '../utils/socketHelpers';

export interface UseOnlineUsersResult {
  onlineUsers: UserInfo[];
}

export function useOnlineUsers(socket: TypedSocket, logger: ILogger): UseOnlineUsersResult {
  const [onlineUsers, setOnlineUsers] = useState<UserInfo[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleUsersList = (users: UserInfo[]) => {
      setOnlineUsers(users);
    };

    const eventMap = {
      users_list: handleUsersList,
    };

    registerSocketEvents(socket, eventMap);

    return () => {
      unregisterSocketEvents(socket, eventMap);
    };
  }, [socket, logger]);

  return { onlineUsers };
}
