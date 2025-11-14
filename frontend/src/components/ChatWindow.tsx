import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createChildLogger } from '@chat-app/shared';
import { ChatWindowProps } from '../types';
import Header from './Header';
import OnlineStatusBar from './OnlineStatusBar';
import MessagesContainer from './MessagesContainer';
import MessageInputForm from './MessageInputForm';
import { useChatMessages } from '../hooks/useChatMessages';
import { useSocketConnection } from '../hooks/useSocketConnection';
import { useOnlineUsers } from '../hooks/useOnlineUsers';
import { useTypingIndicator } from '../hooks/useTypingIndicator';

const ChatWindow: React.FC<ChatWindowProps> = ({ socket, windowId, username, color }) => {
  const [inputMessage, setInputMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create a logger specific to this chat window
  const logger = useMemo(
    () => createChildLogger({ component: 'ChatWindow', windowId, username }),
    [windowId, username]
  );

  // Custom hooks for managing chat functionality
  const { messages, isLoadingHistory, requestHistory } = useChatMessages(socket, logger);
  const { isConnected } = useSocketConnection(socket, username, logger, requestHistory);
  const { onlineUsers } = useOnlineUsers(socket, logger);
  const { typingUsers, handleInputChange: handleTypingInputChange, clearTypingOnSubmit } = useTypingIndicator(
    socket,
    isConnected,
    logger
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && socket && isConnected) {
      logger.info({ textLength: inputMessage.length }, 'Sending message');
      socket.emit('send_message', { text: inputMessage });
      setInputMessage('');
      clearTypingOnSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleTypingInputChange(e, setInputMessage);
  };

  return (
    <div
      className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden border-t-4"
      style={{ borderTopColor: color }}
    >
      <Header windowId={windowId} color={color} isConnected={isConnected} username={username} />
      <OnlineStatusBar onlineUsers={onlineUsers} />
      <MessagesContainer
        messages={messages}
        username={username}
        typingUsers={typingUsers}
        messagesEndRef={messagesEndRef}
        isLoadingHistory={isLoadingHistory}
      />
      <MessageInputForm
        inputMessage={inputMessage}
        isConnected={isConnected}
        onSubmit={handleSendMessage}
        onChange={handleInputChange}
      />
    </div>
  );
};

export default ChatWindow;
