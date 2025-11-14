import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createChildLogger, Message, UserInfo, UserJoinedPayload, UserLeftPayload, UserTypingPayload } from '@chat-app/shared';
import { ChatWindowProps } from '../types';

const ChatWindow: React.FC<ChatWindowProps> = ({ socket, windowId, username, color }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<UserInfo[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create a logger specific to this chat window
  const logger = useMemo(
    () => createChildLogger({ component: 'ChatWindow', windowId, username }),
    [windowId, username]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      logger.info('Connected to server');
      socket.emit('join', username);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      logger.warn('Disconnected from server');
    };

    const handleReceiveMessage = (message: Message) => {
      logger.debug(
        { messageId: message.id, from: message.username, textLength: message.text.length },
        'Message received'
      );
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    const handleUserJoined = (data: UserJoinedPayload) => {
      logger.info({ joinedUser: data.username }, 'User joined chat');
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        username: 'System',
        userId: 'system',
        text: `${data.username} joined the chat`,
        timestamp: data.timestamp,
        isSystem: true
      };
      setMessages((prevMessages) => [...prevMessages, systemMessage]);
    };

    const handleUserLeft = (data: UserLeftPayload) => {
      logger.info({ leftUser: data.username }, 'User left chat');
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        username: 'System',
        userId: 'system',
        text: `${data.username} left the chat`,
        timestamp: data.timestamp,
        isSystem: true
      };
      setMessages((prevMessages) => [...prevMessages, systemMessage]);
    };

    const handleUsersList = (users: UserInfo[]) => {
      logger.debug({ userCount: users.length }, 'Users list updated');
      setOnlineUsers(users);
    };

    const handleUserTyping = (data: UserTypingPayload) => {
      logger.debug({ typingUser: data.username, isTyping: data.isTyping }, 'Typing status changed');
      if (data.isTyping) {
        setTypingUsers((prev) => new Set(prev).add(data.username));
      } else {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(data.username);
          return newSet;
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('users_list', handleUsersList);
    socket.on('user_typing', handleUserTyping);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('users_list', handleUsersList);
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket, windowId, username, logger]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && socket && isConnected) {
      logger.info({ textLength: inputMessage.length }, 'Sending message');
      socket.emit('send_message', { text: inputMessage });
      setInputMessage('');

      // Stop typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socket.emit('typing', false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);

    if (!socket || !isConnected) return;

    // Emit typing indicator
    socket.emit('typing', true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', false);
    }, 1000);
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden border-t-4"
      style={{ borderTopColor: color }}
    >
      {/* Header */}
      <div
        className="p-4 text-white flex flex-wrap justify-between items-center gap-2"
        style={{ backgroundColor: color }}
      >
        <h3 className="text-lg font-semibold">Chat Window {windowId}</h3>
        <div className="flex items-center gap-2 text-xs px-2 py-1 bg-white bg-opacity-20 rounded-full">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse-slow' : 'bg-red-400'}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        <div className="text-xs w-full mt-1">
          Logged in as: <strong>{username}</strong>
        </div>
      </div>

      {/* Online Users Bar */}
      <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 text-sm text-gray-600 flex gap-2 items-center">
        <span className="font-semibold text-gray-700">Online ({onlineUsers.length}):</span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
          {onlineUsers.map((user) => user.name).join(', ') || 'None'}
        </span>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-5 bg-gray-50 flex flex-col gap-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`
              max-w-[70%] px-3.5 py-2.5 rounded-xl break-words animate-slide-in
              ${msg.isSystem
                ? 'self-center bg-yellow-100 text-yellow-900 text-xs px-3 py-1.5 border border-yellow-300'
                : msg.username === username
                ? 'self-end bg-blue-500 text-white'
                : 'self-start bg-white border border-gray-200'
              }
            `}
          >
            {!msg.isSystem && (
              <div className="flex justify-between items-center mb-1 gap-2">
                <span className={`text-xs font-semibold ${msg.username === username ? 'text-white text-opacity-90' : 'text-gray-900'}`}>
                  {msg.username}
                </span>
                <span className={`text-[10px] opacity-70 ${msg.username === username ? 'text-white' : 'text-gray-600'}`}>
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
            )}
            <div className="text-sm leading-6">{msg.text}</div>
          </div>
        ))}
        {typingUsers.size > 0 && (
          <div className="self-start px-3 py-2 bg-gray-200 rounded-xl text-xs text-gray-600 italic animate-fade-in">
            {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Form */}
      <form className="flex gap-2.5 p-4 bg-white border-t border-gray-200" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputMessage}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-full text-sm outline-none focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={!isConnected}
        />
        <button
          type="submit"
          className="px-6 py-3 bg-blue-500 text-white rounded-full text-sm font-semibold hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={!isConnected || !inputMessage.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatWindow;
