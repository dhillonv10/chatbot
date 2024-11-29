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

export const customModel = (apiIdentifier: string) => {
  const model: LanguageModelV1 = {
    specificationVersion: 'v1',
    provider: 'anthropic',
    modelId: apiIdentifier,
    defaultObjectGenerationMode: 'json',

    async doStream(options: LanguageModelV1CallOptions) {
      const response = await anthropic.messages.create({
        model: apiIdentifier,
        messages: [{
          role: 'user',
          content: options.prompt.join('\n'),
        }],
        stream: true,
        max_tokens: 4096,
      });

      return {
        stream: response.toReadableStream() as ReadableStream<LanguageModelV1StreamPart>,
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: {
            model: apiIdentifier,
            max_tokens: 4096,
            stream: true,
          },
        },
      };
    },

    async doCompletion(options: LanguageModelV1CallOptions) {
      const response = await anthropic.messages.create({
        model: apiIdentifier,
        messages: [{
          role: 'user',
          content: options.prompt.join('\n'),
        }],
        max_tokens: 4096,
      });

      return {
        content: response.content[0].text,
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: {
            model: apiIdentifier,
            max_tokens: 4096,
          },
        },
      };
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
