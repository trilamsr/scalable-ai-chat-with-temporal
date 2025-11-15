import { UserInfo, createChildLogger } from '@chat-app/shared';

const logger = createChildLogger({ module: 'user-manager' });

interface UserData {
  username: string;
  roomId: string;
}

/**
 * Manages connected users and their information
 * Provides centralized user state management with room support
 */
export class UserManager {
  private connectedUsers: Map<string, UserData>;

  constructor() {
    this.connectedUsers = new Map();
  }

  /**
   * Add a user to the connected users list
   * @param socketId - Socket ID of the user
   * @param username - Username of the user
   * @param roomId - Room the user is joining
   */
  addUser(socketId: string, username: string, roomId: string): void {
    this.connectedUsers.set(socketId, { username, roomId });
    logger.info(
      { username, socketId, roomId, totalUsers: this.connectedUsers.size },
      'User added to room'
    );
  }

  /**
   * Remove a user from the connected users list
   * @param socketId - Socket ID of the user
   * @returns UserData of the removed user, or undefined if not found
   */
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

  /**
   * Get username for a given socket ID
   * @param socketId - Socket ID to look up
   * @returns Username, or 'Anonymous' if not found
   */
  getUsername(socketId: string): string {
    return this.connectedUsers.get(socketId)?.username || 'Anonymous';
  }

  /**
   * Get room for a given socket ID
   * @param socketId - Socket ID to look up
   * @returns Room name, or undefined if not found
   */
  getRoomId(socketId: string): string | undefined {
    return this.connectedUsers.get(socketId)?.roomId;
  }

  /**
   * Get list of all connected users in a specific room
   * @param roomId - Room name to filter by (optional - returns all if not provided)
   * @returns Array of UserInfo objects
   */
  getUsersList(roomId?: string): UserInfo[] {
    return Array.from(this.connectedUsers.entries())
      .filter(([_, userData]) => !roomId || userData.roomId === roomId)
      .map(([id, userData]) => ({
        id,
        name: userData.username,
        roomId: userData.roomId,
      }));
  }

  /**
   * Get total number of connected users
   * @param roomId - Room name to filter by (optional - returns all if not provided)
   * @returns User count
   */
  getUserCount(roomId?: string): number {
    if (!roomId) {
      return this.connectedUsers.size;
    }

    // Use direct iteration for better performance
    let count = 0;
    for (const userData of this.connectedUsers.values()) {
      if (userData.roomId === roomId) count++;
    }
    return count;
  }

  /**
   * Check if a user is connected
   * @param socketId - Socket ID to check
   * @returns True if user is connected
   */
  isUserConnected(socketId: string): boolean {
    return this.connectedUsers.has(socketId);
  }
}
