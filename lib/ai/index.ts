import {
  experimental_wrapLanguageModel as wrapLanguageModel,
  type LanguageModelV1,
  type LanguageModelV1CallOptions,
  type LanguageModelV1StreamPart,
} from 'ai';
import { Anthropic, MessageParam } from '@anthropic-ai/sdk';

// Define LanguageModelV1Message type locally
type LanguageModelV1Message = {
  role: 'user' | 'assistant';
  content: string;
};

// Check for the required environment variable
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Convert LanguageModelV1Message to Anthropic's MessageParam format
const convertToAnthropicMessages = (messages: LanguageModelV1Message[]): MessageParam[] => {
  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
  }));
};

// Define the custom language model
export const customModel = (apiIdentifier: string) => {
  const model: LanguageModelV1 = {
    specificationVersion: 'v1',
    provider: 'anthropic',
    modelId: apiIdentifier,
    defaultObjectGenerationMode: 'json',

    async doStream(options: LanguageModelV1CallOptions) {
      try {
        const messages = Array.isArray(options.prompt)
          ? [{ role: 'user', content: options.prompt[0] }]
          : [options.prompt];

        const response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: convertToAnthropicMessages(messages),
          stream: true,
          max_tokens: 1024,
        });

        return {
          stream: response.toReadableStream() as ReadableStream<LanguageModelV1StreamPart>,
          rawCall: {
            rawPrompt: options.prompt,
            rawSettings: {
              model: apiIdentifier,
              max_tokens: 1024,
              stream: true,
            },
          },
        };
      } catch (error) {
        console.error('Anthropic API Error:', error);
        throw error;
      }
    },

    async doComplete(options: LanguageModelV1CallOptions) {
      try {
        const messages = Array.isArray(options.prompt)
          ? [{ role: 'user', content: options.prompt[0] }]
          : [options.prompt];

        const response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: convertToAnthropicMessages(messages),
          max_tokens: 1024,
        });

        return {
          content: response.completion, // Adjusted to match expected API output
          rawCall: {
            rawPrompt: options.prompt,
            rawSettings: {
              model: apiIdentifier,
              max_tokens: 1024,
            },
          },
        };
      } catch (error) {
        console.error('Anthropic API Error:', error);
        throw error;
      }
    },

    async doGenerate(options: LanguageModelV1CallOptions) {
      throw new Error('Object generation not implemented');
    },
  };

  return wrapLanguageModel({
    model,
    middleware: {
      async chatCompletion(options) {
        return options;
      },
      async completion(options) {
        return options;
      },
    },
  });
};
