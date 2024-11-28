import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai';
import { claudeStream, claudeCompletion } from './claude';
import { customMiddleware } from './custom-middleware';

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: {
      doStream: async (messages, options) => {
        return await claudeStream(messages, apiIdentifier);
      },
      doCompletion: async (messages, options) => {
        return await claudeCompletion(messages, apiIdentifier);
      }
    },
    middleware: customMiddleware,
  });
};
