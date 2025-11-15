/**
 * AI Service Implementation using Vercel AI SDK
 * Implements the IAIStreamService interface from shared module
 */

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  IAIStreamService,
  AIStreamOptions,
  AIStreamEvent,
  AIStreamResult,
  createChildLogger,
} from '@chat-app/shared';
import { getErrorMessage } from '../utils/errorHelpers';

const logger = createChildLogger({ module: 'AIService' });

/**
 * Implementation of AI streaming service using Vercel AI SDK
 */
export class AIService implements IAIStreamService {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel: string = 'gpt-4o-mini') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.defaultModel = defaultModel;

    if (!this.apiKey) {
      logger.warn('OpenAI API key not provided. AI features will not work.');
    }
  }

  /**
   * Stream text generation from OpenAI
   */
  async *streamText(options: AIStreamOptions): AsyncIterable<AIStreamEvent> {
    if (!this.apiKey) {
      yield {
        type: 'error',
        error: 'OpenAI API key not configured',
      };
      return;
    }

    try {
      const model = openai(options.model || this.defaultModel);

      logger.info(
        {
          model: options.model || this.defaultModel,
          hasMessages: !!options.messages,
          hasPrompt: !!options.prompt,
          hasTools: !!options.tools,
        },
        'Starting AI stream'
      );

      const stream = await streamText({
        model,
        prompt: options.prompt,
        messages: options.messages as any, // Cast to avoid type mismatch with AI SDK
        system: options.system,
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: options.topP,
        presencePenalty: options.presencePenalty,
        frequencyPenalty: options.frequencyPenalty,
        stopSequences: options.stopSequences,
        seed: options.seed,
        abortSignal: options.abortSignal,
        maxRetries: options.maxRetries ?? 2,
      });

      // Stream text chunks
      for await (const chunk of stream.textStream) {
        const event: AIStreamEvent = {
          type: 'text-delta',
          delta: chunk,
        };

        yield event;
        options.onTextDelta?.(chunk);
      }

      // Get final result
      const result = await stream;
      const usage = await result.usage;

      const finishEvent: AIStreamEvent = {
        type: 'finish',
        finishReason: result.finishReason as any,
        usage: {
          promptTokens: usage.inputTokens || 0,
          completionTokens: usage.outputTokens || 0,
          totalTokens: usage.totalTokens || 0,
        },
      };

      yield finishEvent;

      logger.info(
        {
          finishReason: result.finishReason,
          totalTokens: usage.totalTokens || 0,
        },
        'AI stream completed'
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error({ error: errorMessage }, 'AI stream error');

      yield {
        type: 'error',
        error: errorMessage,
      };

      options.onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }

  /**
   * Stream text and collect the full result
   */
  async streamTextComplete(options: AIStreamOptions): Promise<AIStreamResult> {
    let fullText = '';
    let finalEvent: AIStreamEvent | null = null;

    for await (const event of this.streamText(options)) {
      if (event.delta) {
        fullText += event.delta;
      }
      if (event.type === 'finish') {
        finalEvent = event;
      }
      if (event.type === 'error') {
        throw new Error(event.error);
      }
    }

    return {
      text: fullText,
      finishReason: (finalEvent?.finishReason as any) || 'stop',
      usage: finalEvent?.usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }
}
