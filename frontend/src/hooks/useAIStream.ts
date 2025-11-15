/**
 * Hook for managing AI streaming state
 * Handles AI stream start, chunks, finish, and error events
 */

import { useState, useEffect, useCallback } from 'react';
import { TypedSocket } from '../types';
import {
  ILogger,
  AIStreamStartPayload,
  AIStreamChunkPayload,
  AIStreamFinishPayload,
  AIStreamErrorPayload,
  Message,
  AI_USER,
} from '@chat-app/shared';
import { registerSocketEvents, unregisterSocketEvents } from '../utils/socketHelpers';

export interface AIStreamState {
  isStreaming: boolean;
  currentMessageId: string | null;
  accumulatedText: string;
  error: string | null;
}

export interface UseAIStreamResult {
  aiStreamState: AIStreamState;
  aiMessage: Message | null;
}

export interface UseAIStreamOptions {
  onFinish?: (message: Message) => void;
}

export function useAIStream(
  socket: TypedSocket,
  roomId: string,
  logger: ILogger,
  options?: UseAIStreamOptions
): UseAIStreamResult {
  const [aiStreamState, setAIStreamState] = useState<AIStreamState>({
    isStreaming: false,
    currentMessageId: null,
    accumulatedText: '',
    error: null,
  });

  const [aiMessage, setAIMessage] = useState<Message | null>(null);

  // Handle AI stream start
  const handleAIStreamStart = useCallback(
    (payload: AIStreamStartPayload) => {
      if (payload.roomId !== roomId) return;

      logger.info({ messageId: payload.messageId }, 'AI stream started');

      setAIStreamState({
        isStreaming: true,
        currentMessageId: payload.messageId,
        accumulatedText: '',
        error: null,
      });

      // Create initial AI message
      const initialMessage: Message = {
        id: payload.messageId,
        username: AI_USER.USERNAME,
        userId: AI_USER.USER_ID,
        text: '',
        timestamp: payload.timestamp,
        roomId: payload.roomId,
        isSystem: false,
      };

      setAIMessage(initialMessage);
    },
    [roomId, logger]
  );

  // Handle AI stream chunk
  const handleAIStreamChunk = useCallback(
    (payload: AIStreamChunkPayload) => {
      if (payload.roomId !== roomId) return;

      logger.debug({ messageId: payload.messageId, chunkLength: payload.chunk.length }, 'AI chunk received');

      setAIStreamState((prev) => ({
        ...prev,
        accumulatedText: payload.accumulatedText,
      }));

      // Update AI message with accumulated text
      setAIMessage((prevMessage) => {
        if (prevMessage && prevMessage.id === payload.messageId) {
          return {
            ...prevMessage,
            text: payload.accumulatedText,
          };
        }
        return prevMessage;
      });
    },
    [roomId, logger]
  );

  // Handle AI stream finish
  const handleAIStreamFinish = useCallback(
    (payload: AIStreamFinishPayload) => {
      if (payload.roomId !== roomId) return;

      logger.info(
        { messageId: payload.messageId, textLength: payload.fullText.length, usage: payload.usage },
        'AI stream finished'
      );

      setAIStreamState({
        isStreaming: false,
        currentMessageId: null,
        accumulatedText: '',
        error: null,
      });

      // Finalize AI message and call onFinish callback
      setAIMessage((prevMessage) => {
        if (prevMessage && prevMessage.id === payload.messageId) {
          const finalMessage = {
            ...prevMessage,
            text: payload.fullText,
            timestamp: payload.timestamp,
          };
          // Call onFinish callback to add message to regular messages
          options?.onFinish?.(finalMessage);
        }
        return null;
      });
    },
    [roomId, logger, options]
  );

  // Handle AI stream error
  const handleAIStreamError = useCallback(
    (payload: AIStreamErrorPayload) => {
      if (payload.roomId !== roomId) return;

      logger.error({ messageId: payload.messageId, error: payload.error }, 'AI stream error');

      setAIStreamState({
        isStreaming: false,
        currentMessageId: null,
        accumulatedText: '',
        error: payload.error,
      });

      setAIMessage(null);
    },
    [roomId, logger]
  );

  useEffect(() => {
    if (!socket) return;

    const eventMap = {
      ai_stream_start: handleAIStreamStart,
      ai_stream_chunk: handleAIStreamChunk,
      ai_stream_finish: handleAIStreamFinish,
      ai_stream_error: handleAIStreamError,
    };

    registerSocketEvents(socket, eventMap);

    return () => {
      unregisterSocketEvents(socket, eventMap);
    };
  }, [socket, handleAIStreamStart, handleAIStreamChunk, handleAIStreamFinish, handleAIStreamError]);

  return { aiStreamState, aiMessage };
}
