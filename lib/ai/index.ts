import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '' // Handle empty string case for Vercel env
});

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      // Format messages with explicit type literals
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const response = await anthropic.messages.create({
        model: apiIdentifier,
        messages: formattedMessages,
        system: options?.system,
        max_tokens: 4096,
        stream: true
      });

      // Convert Anthropic's Stream to a ReadableStream
      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of response) {
            console.log('Received chunk:', chunk); // Debug log
            if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
              // Format as SSE data
              const data = JSON.stringify({ text: chunk.delta.text });
              controller.enqueue(`data: ${data}\n\n`);
            }
          }
          controller.close();
        }
      });

      return stream;
    }
  };
};
