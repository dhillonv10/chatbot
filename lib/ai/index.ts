import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai';
import { claudeStream, claudeCompletion } from './claude';
import { customMiddleware } from './custom-middleware';

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: {
      id: apiIdentifier,
      stream: async (messages, options) => {
        return await claudeStream(messages, apiIdentifier);
      },
      completion: async (messages, options) => {
        return await claudeCompletion(messages, apiIdentifier);
      }
    },
    middleware: customMiddleware,
  });
};
