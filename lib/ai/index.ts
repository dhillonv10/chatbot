// lib/ai/index.ts
import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      console.log('Starting chat invocation');
      
      try {
        const response = await anthropic.messages.stream({
          model: apiIdentifier,
          messages,
          system: options?.system,
          max_tokens: 4096
        });

        const encoder = new TextEncoder();
        let streamClosed = false;

        return new ReadableStream({
          async start(controller) {
            try {
              let fullContent = '';
              const messageId = crypto.randomUUID();

              for await (const chunk of response) {
                if (streamClosed) break;

                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  fullContent += chunk.delta.text;
                  const chunkData = {
                    id: messageId,
                    role: 'assistant',
                    content: fullContent,
                    createdAt: new Date().toISOString()
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
                } else if (chunk.type === 'message_stop') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  controller.close();
                  break;
                }
              }
            } catch (error) {
              console.error('Stream error:', error);
              controller.error(error);
            }
          },
          cancel() {
            streamClosed = true;
          },
        });
      } catch (error) {
        console.error('Anthropic API error:', error);
        throw error;
      }
    },
  };
};