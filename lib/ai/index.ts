import {
  experimental_wrapLanguageModel as wrapLanguageModel,
  type LanguageModelV1CallOptions,
  type LanguageModelV1StreamPart
} from 'ai';
import { claudeStream } from './claude';
import { customMiddleware } from './custom-middleware';

export const customModel = (apiIdentifier: string) => {
  return wrapLanguageModel({
    model: {
      doStream: async (options: LanguageModelV1CallOptions) => {
        // Transform LanguageModelV1Prompt to Message[]
        const messages = options.prompt.map((message, index) => ({
          id: `${index}-${Date.now()}`, // Generate a unique id for each message
          role: message.role === 'tool' ? 'assistant' : message.role, // Map 'tool' role to 'assistant'
          content: typeof message.content === 'string'
            ? message.content
            : Array.isArray(message.content)
            ? message.content.map(part => {
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
    },
    middleware: customMiddleware,
  });
};
