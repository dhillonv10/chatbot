import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const convertToAnthropicMessages = (messages: Message[]): AnthropicMessage[] => {
  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
  }));
};

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      console.log('Invoking model with:', { apiIdentifier, messages: messages.length });
      
      const response = await anthropic.messages.create({
        model: apiIdentifier,
        messages: convertToAnthropicMessages(messages),
        stream: true,
        max_tokens: 4096,
        system: options?.system,
      });

      // Create a ReadableStream that will emit the text chunks
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of response) {
              console.log('Received chunk:', chunk);
              if (chunk.type === 'content_block_delta') {
                controller.enqueue(chunk.delta.text);
              } else if (chunk.type === 'message_delta') {
                // Handle potential different response format
                controller.enqueue(chunk.delta.text || chunk.delta.content || '');
              }
            }
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          }
        },
      });

      return stream;
    },
  };
};
