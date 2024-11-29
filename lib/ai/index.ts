import { experimental_wrapLanguageModel as wrapLanguageModel, type LanguageModelV1CallOptions, type LanguageModelV1StreamPart } from 'ai';
import { claudeStream, claudeCompletion } from './claude';
import { customMiddleware } from './custom-middleware';

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: {
      doStream: async (options: LanguageModelV1CallOptions) => {
        const response = await claudeStream(options.messages, apiIdentifier);
        return {
          stream: response as unknown as ReadableStream<LanguageModelV1StreamPart>,
          rawCall: {
            rawPrompt: options.messages,
            rawSettings: {
              model: apiIdentifier,
              max_tokens: 4096,
              stream: true
            }
          }
        };
      },
      doCompletion: async (options: LanguageModelV1CallOptions) => {
        const response = await claudeCompletion(options.messages, apiIdentifier);
        return {
          content: response,
          rawCall: {
            rawPrompt: options.messages,
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
