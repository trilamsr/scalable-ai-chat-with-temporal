import React from 'react';
import { Message } from '@chat-app/shared';
import { formatTimestamp } from '../utils/messageHelpers';

interface MessagesContainerProps {
  messages: Message[];
  username: string;
  typingUsers: Set<string>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  isLoadingHistory?: boolean;
}

/**
 * Memoized MessagesContainer to prevent unnecessary re-renders
 * Only re-renders when messages, username, typingUsers, or isLoadingHistory change
 */
const MessagesContainer: React.FC<MessagesContainerProps> = React.memo(({
  messages,
  username,
  typingUsers,
  messagesEndRef,
  isLoadingHistory = false,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-50 flex flex-col gap-3">
      {isLoadingHistory && (
        <div className="self-center px-3 py-2 bg-blue-100 text-blue-700 rounded-xl text-xs animate-pulse">
          Loading chat history...
        </div>
      )}
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
  );
});

MessagesContainer.displayName = 'MessagesContainer';

export default MessagesContainer;
