import {
  experimental_wrapLanguageModel as wrapLanguageModel,
  type LanguageModelV1CallOptions,
  type LanguageModelV1StreamPart,
  type LanguageModelV1Prompt
} from 'ai';
import { claudeStream, claudeCompletion } from './claude';
import { customMiddleware } from './custom-middleware';

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: {
      doStream: async (options: LanguageModelV1CallOptions) => {
        // Transform LanguageModelV1Prompt to Message[]
        const messages = options.prompt.map((message, index) => ({
          id: `${index}-${Date.now()}`, // Generate a unique id for each message
          role: message.role,
          content: typeof message.content === 'string'
            ? message.content
            : Array.isArray(message.content)
            ? message.content.map(part => {
                // Safely map parts to strings
                if (typeof part === 'string') {
                  return part;
                }
                if ('text' in part) {
                  return part.text;
                }
                return '[Non-text content]';
              }).join(' ') // Join all parts into a single string
            : '[Unsupported content]', // Handle unsupported cases
        }));

        const response = await claudeStream(messages, apiIdentifier);
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
        // Transform LanguageModelV1Prompt to Message[]
        const messages = options.prompt.map((message, index) => ({
          id: `${index}-${Date.now()}`, // Generate a unique id for each message
          role: message.role,
          content: typeof message.content === 'string'
            ? message.content
            : Array.isArray(message.content)
            ? message.content.map(part => {
                // Safely map parts to strings
                if (typeof part === 'string') {
                  return part;
                }
                if ('text' in part) {
                  return part.text;
                }
                return '[Non-text content]';
              }).join(' ') // Join all parts into a single string
            : '[Unsupported content]', // Handle unsupported cases
        }));

        const response = await claudeCompletion(messages, apiIdentifier);
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
