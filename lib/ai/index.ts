import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      const response = await anthropic.messages.create({
        model: apiIdentifier,
        messages: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
        stream: true,
        max_tokens: 4096,
        system: options?.system,
      });

      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of response) {
            if (chunk.type === 'content_block_delta') {
              controller.enqueue(chunk.delta.text);
            }
          }
          controller.close();
        },
      });

      return stream;
    },
  };
};
