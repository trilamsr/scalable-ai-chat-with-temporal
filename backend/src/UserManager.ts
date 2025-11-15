import { UserInfo, createChildLogger } from '@chat-app/shared';

const logger = createChildLogger({ module: 'user-manager' });

interface UserData {
  username: string;
  roomId: string;
}

export class UserManager {
  private connectedUsers: Map<string, UserData>;

  constructor() {
    this.connectedUsers = new Map();
  }

  addUser(socketId: string, username: string, roomId: string): void {
    this.connectedUsers.set(socketId, { username, roomId });
    logger.info(
      { username, socketId, roomId, totalUsers: this.connectedUsers.size },
      'User added to room'
    );
  }

  removeUser(socketId: string): UserData | undefined {
    const userData = this.connectedUsers.get(socketId);
    this.connectedUsers.delete(socketId);

    if (userData) {
      logger.info(
        { username: userData.username, socketId, roomId: userData.roomId, totalUsers: this.connectedUsers.size },
        'User removed from room'
      );
    }

    return userData;
  }

  getUsername(socketId: string): string {
    return this.connectedUsers.get(socketId)?.username || 'Anonymous';
  }

  getRoomId(socketId: string): string | undefined {
    return this.connectedUsers.get(socketId)?.roomId;
  }

  getUserContext(socketId: string): { username: string; roomId: string | undefined } {
    const userData = this.connectedUsers.get(socketId);
    return {
      username: userData?.username || 'Anonymous',
      roomId: userData?.roomId,
    };
  }

  getUsersList(roomId?: string): UserInfo[] {
    return Array.from(this.connectedUsers.entries())
      .filter(([_, userData]) => !roomId || userData.roomId === roomId)
      .map(([id, userData]) => ({
        id,
        name: userData.username,
        roomId: userData.roomId,
      }));
  }

  getUserCount(roomId?: string): number {
    if (!roomId) {
      return this.connectedUsers.size;
    }

    let count = 0;
    for (const userData of this.connectedUsers.values()) {
      if (userData.roomId === roomId) {
        count++;
      }
    }
    return count;
  }

  isUserConnected(socketId: string): boolean {
    return this.connectedUsers.has(socketId);
  }
}

