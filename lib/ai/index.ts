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

      console.log('Starting API call with messages:', messages);
      const response = await anthropic.messages.create({
        model: apiIdentifier,
        messages: formattedMessages,
        system: options?.system,
        max_tokens: 4096,
        stream: true
      });

      console.log('Got response from Anthropic');
      
      // Convert to a ReadableStream
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const queue = encoder.encode('{"id":"message_1","role":"assistant","content":"');
          controller.enqueue(queue);
          
          try {
            let content = '';
            for await (const chunk of response) {
              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                content += chunk.delta.text;
                const encoded = encoder.encode(chunk.delta.text);
                controller.enqueue(encoded);
              }
            }
            controller.enqueue(encoder.encode('"}'));
            controller.close();
          } catch (error) {
            console.error('Stream error:', error);
            controller.error(error);
          }
        }
      });

      return stream;
    }
  };
};
