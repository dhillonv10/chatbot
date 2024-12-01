import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { streamText } from 'ai';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '', // Handle empty string case for Vercel env
});

// Extend the LanguageModelV1 type to include the required model
type LanguageModelV1 = 'claude-3-5-sonnet-20241022'; // Extend this with additional models as needed

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }): Promise<Response> {
      // Format messages to match the expected structure
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      console.log('Starting API call with messages:', formattedMessages);

      // Use streamText to handle the streamed response
      const result = streamText({
        model: 'claude-3-5-sonnet-20241022' as LanguageModelV1, // Explicit cast to the correct type
        maxTokens: 4096,
        messages: formattedMessages,
        system: options?.system,
      });

      // Return the response as a stream
      return result.toTextStreamResponse();
    },
  };
};
