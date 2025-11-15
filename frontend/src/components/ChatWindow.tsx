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
import { useAIStream } from '../hooks/useAIStream';

const ChatWindow: React.FC<ChatWindowProps> = ({ socket, windowId, username, color, roomId }) => {
  const [inputMessage, setInputMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const logger = useMemo(
    () => createChildLogger({ component: 'ChatWindow', windowId, username, roomId }),
    [windowId, username, roomId]
  );

  const { messages, isLoadingHistory, requestHistory, setMessages } = useChatMessages(socket, logger);
  const { isConnected } = useSocketConnection(socket, username, roomId, logger, requestHistory);
  const { onlineUsers } = useOnlineUsers(socket, logger);
  const { typingUsers, handleInputChange: handleTypingInputChange, clearTypingOnSubmit } = useTypingIndicator(
    socket,
    isConnected,
    logger
  );
  const { aiStreamState, aiMessage } = useAIStream(socket, roomId, logger, {
    onFinish: (finalMessage) => {
      setMessages((prev) => [...prev, finalMessage]);
    },
  });

  const allMessages = useMemo(() => {
    const combined = [...messages];
    if (aiMessage && aiStreamState.isStreaming) {
      combined.push(aiMessage);
    }
    return combined;
  }, [messages, aiMessage, aiStreamState.isStreaming]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [allMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (aiStreamState.isStreaming) {
      logger.debug('Message send blocked: AI is streaming');
      return;
    }

    if (inputMessage.trim() && socket && isConnected) {
      const messageText = inputMessage.trim();
      logger.info({ textLength: messageText.length }, 'Sending message');

      socket.emit('send_message', { text: messageText, roomId }, (ack) => {
        if (ack.success) {
          logger.debug({ messageId: ack.messageId }, 'Message acknowledged and persisted');
        } else {
          logger.error({ error: ack.error, code: ack.code }, 'Message failed to send or persist');
        }
      });

      setInputMessage('');
      clearTypingOnSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleTypingInputChange(e, setInputMessage);
  };

  const handleClearHistory = () => {
    if (!socket || !isConnected) return;

    logger.warn({ roomId }, 'Clearing chat history');

    socket.emit('clear_history', roomId, (response) => {
      if (response?.success) {
        logger.info({ roomId }, 'Chat history cleared successfully');
        setMessages([]);
      } else {
        logger.error({ error: response?.error }, 'Failed to clear chat history');
        alert('Failed to clear chat history. Please try again.');
      }
    });
  };

  return (
    <div
      className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden border-t-4"
      style={{ borderTopColor: color }}
    >
      <Header windowId={windowId} color={color} isConnected={isConnected} username={username} roomId={roomId} onClearHistory={handleClearHistory} />
      <OnlineStatusBar onlineUsers={onlineUsers} />
      <MessagesContainer
        messages={allMessages}
        username={username}
        typingUsers={typingUsers}
        messagesEndRef={messagesEndRef}
        isLoadingHistory={isLoadingHistory}
      />
      <MessageInputForm
        inputMessage={inputMessage}
        isConnected={isConnected && !aiStreamState.isStreaming}
        onSubmit={handleSendMessage}
        onChange={handleInputChange}
        placeholder={aiStreamState.isStreaming ? 'AI is responding...' : undefined}
      />
    </div>
  );
};

export default ChatWindow;
