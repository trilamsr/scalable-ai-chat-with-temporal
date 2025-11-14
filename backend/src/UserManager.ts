import { UserInfo, createChildLogger } from '@chat-app/shared';

const userLogger = createChildLogger({ module: 'user-manager' });

/**
 * Manages connected users and their information
 * Provides centralized user state management
 */
export class UserManager {
  private connectedUsers: Map<string, string>;

  constructor() {
    this.connectedUsers = new Map();
  }

  /**
   * Add a user to the connected users list
   * @param socketId - Socket ID of the user
   * @param username - Username of the user
   */
  addUser(socketId: string, username: string): void {
    this.connectedUsers.set(socketId, username);
    userLogger.info(
      { username, socketId, totalUsers: this.connectedUsers.size },
      'User added'
    );
  }

  /**
   * Remove a user from the connected users list
   * @param socketId - Socket ID of the user
   * @returns Username of the removed user, or undefined if not found
   */
  removeUser(socketId: string): string | undefined {
    const username = this.connectedUsers.get(socketId);
    this.connectedUsers.delete(socketId);

    if (username) {
      userLogger.info(
        { username, socketId, totalUsers: this.connectedUsers.size },
        'User removed'
      );
    }

    return username;
  }

  /**
   * Get username for a given socket ID
   * @param socketId - Socket ID to look up
   * @returns Username, or 'Anonymous' if not found
   */
  getUsername(socketId: string): string {
    return this.connectedUsers.get(socketId) || 'Anonymous';
  }

  /**
   * Get list of all connected users
   * @returns Array of UserInfo objects
   */
  getUsersList(): UserInfo[] {
    return Array.from(this.connectedUsers.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }

  /**
   * Get total number of connected users
   * @returns User count
   */
  getUserCount(): number {
    return this.connectedUsers.size;
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

// Export singleton instance
export const userManager = new UserManager();
