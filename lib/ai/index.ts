import {
  experimental_wrapLanguageModel as wrapLanguageModel,
  type LanguageModelV1,
  type LanguageModelV1CallOptions,
  type LanguageModelV1StreamPart,
} from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper function to convert prompts to messages
const promptToMessages = (prompt: string[]) => {
  // If it's a single message, send it as user message
  if (prompt.length === 1) {
    return [{
      role: 'user',
      content: prompt[0],
    }];
  }

  // For multiple messages, alternate between user and assistant
  return prompt.map((content, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content,
  }));
};

export const customModel = (apiIdentifier: string) => {
  const model: LanguageModelV1 = {
    specificationVersion: 'v1',
    provider: 'anthropic',
    modelId: apiIdentifier,
    defaultObjectGenerationMode: 'json',

    async doStream(options: LanguageModelV1CallOptions) {
      const messages = promptToMessages(options.prompt);
      
      try {
        const response = await anthropic.messages.create({
          model: apiIdentifier,
          messages,
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
      const messages = promptToMessages(options.prompt);
      
      try {
        const response = await anthropic.messages.create({
          model: apiIdentifier,
          messages,
          max_tokens: 1024,
        });

        return {
          content: response.content[0].text,
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
