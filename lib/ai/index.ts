import { anthropic } from '@anthropic-ai/sdk';
import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai';

import { customMiddleware } from './custom-middleware';
import { convertToAnthropicMessages, sanitizeAnthropicResponse } from './utils';
import type { AnthropicResponse } from './types';

// Initialize Anthropic client
const client = new anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: {
      id: apiIdentifier,
      invoke: async ({ messages, functions, temperature = 0.7, maxTokens }) => {
        try {
          const anthropicMessages = convertToAnthropicMessages(messages);
          
          const response = await client.messages.create({
            model: apiIdentifier,
            messages: anthropicMessages,
            temperature,
            max_tokens: maxTokens,
            system: functions?.system || undefined,
          });

          const content = sanitizeAnthropicResponse(response.content[0].text);

          return {
            role: 'assistant',
            content,
          };
        } catch (error) {
          console.error('Error calling Anthropic API:', error);
          throw error;
        }
      },
    },
    middleware: customMiddleware,
  });
};