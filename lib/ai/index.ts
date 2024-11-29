import {
  experimental_wrapLanguageModel as wrapLanguageModel,
  type LanguageModelV1CallOptions,
  type LanguageModelV1StreamPart
} from 'ai';
import { claudeStream, claudeCompletion } from './claude';
import { customMiddleware } from './custom-middleware';

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: {
      doStream: async (options: LanguageModelV1CallOptions) => {
        // Adjusted to use options.prompt instead of options.messages
        const response = await claudeStream(options.prompt, apiIdentifier);
        return {
          stream: response as unknown as ReadableStream<LanguageModelV1StreamPart>,
          rawCall: {
            rawPrompt: options.prompt,
            rawSettings: {
              model: apiIdentifier,
              max_tokens: 4096,
              stream: true
            }
          }
        };
      },
      doCompletion: async (options: LanguageModelV1CallOptions) => {
        // Adjusted to use options.prompt instead of options.messages
        const response = await claudeCompletion(options.prompt, apiIdentifier);
        return {
          content: response,
          rawCall: {
            rawPrompt: options.prompt,
            rawSettings: {
              model: apiIdentifier,
              max_tokens: 4096
            }
          }
        };
      }
    },
    middleware: customMiddleware,
  });
};
