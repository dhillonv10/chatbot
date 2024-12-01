import {
  experimental_wrapLanguageModel as wrapLanguageModel,
  type LanguageModelV1,
  type LanguageModelV1CallOptions,
  type LanguageModelV1Message,
  type LanguageModelV1StreamPart,
} from 'ai';
import { Anthropic, MessageParam } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const convertToAnthropicMessages = (messages: LanguageModelV1Message[]): MessageParam[] => {
  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
  }));
};

export const customModel = (apiIdentifier: string) => {
  const model: LanguageModelV1 = {
    specificationVersion: 'v1',
    provider: 'anthropic',
    modelId: apiIdentifier,
    defaultObjectGenerationMode: 'json',

    async doStream(options: LanguageModelV1CallOptions) {
      try {
        const messages = Array.isArray(options.prompt) 
          ? options.prompt.map(msg => typeof msg === 'string' ? { role: 'user', content: msg } : msg)
          : [typeof options.prompt === 'string' ? { role: 'user', content: options.prompt } : options.prompt];

        const response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: convertToAnthropicMessages(messages),
          stream: true,
          max_tokens: 4096,
          temperature: options.temperature ?? 0.7,
          system: options.system,
        });

        return {
          stream: response.toReadableStream() as ReadableStream<LanguageModelV1StreamPart>,
          rawCall: {
            rawPrompt: options.prompt,
            rawSettings: {
              model: apiIdentifier,
              max_tokens: 4096,
              temperature: options.temperature ?? 0.7,
              system: options.system,
            },
          },
        };
      } catch (error) {
        console.error('Error in Claude API call:', error);
        throw new Error(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    },

    async doComplete(options: LanguageModelV1CallOptions) {
      try {
        const messages = Array.isArray(options.prompt) 
          ? options.prompt.map(msg => typeof msg === 'string' ? { role: 'user', content: msg } : msg)
          : [typeof options.prompt === 'string' ? { role: 'user', content: options.prompt } : options.prompt];

        const response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: convertToAnthropicMessages(messages),
          max_tokens: 4096,
          temperature: options.temperature ?? 0.7,
          system: options.system,
        });

        return {
          content: response.content[0].text,
          rawCall: {
            rawPrompt: options.prompt,
            rawSettings: {
              model: apiIdentifier,
              max_tokens: 4096,
              temperature: options.temperature ?? 0.7,
              system: options.system,
            },
          },
        };
      } catch (error) {
        console.error('Error in Claude API call:', error);
        throw new Error(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    },

    async doGenerate(options: LanguageModelV1CallOptions) {
      throw new Error('Object generation not implemented');
    },
  };

  return wrapLanguageModel(model);
};
