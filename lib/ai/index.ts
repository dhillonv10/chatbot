import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      const formattedMessages = messages.map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.content,
      }));

      let response;
      try {
        response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: formattedMessages,
          system: options?.system,
          max_tokens: 4096,
          stream: true,
        });
      } catch (error) {
        console.error('Error during API call to Anthropic:', error);
        throw new Error('Failed to call Anthropic API');
      }

      const encoder = new TextEncoder();
      let streamClosed = false;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullContent = '';
            const messageId = crypto.randomUUID();

            for await (const chunk of response) {
              if (streamClosed) break;

              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                fullContent += chunk.delta.text;
                
                // Create the chunk data in Vercel AI SDK format
                const chunkData = {
                  id: messageId,
                  role: 'assistant',
                  content: fullContent,
                  createdAt: new Date().toISOString(),
                };

                // Send in the exact format expected by Vercel AI SDK
                const payload = JSON.stringify(chunkData);
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
              } else if (chunk.type === 'message_stop') {
                // Send the final DONE message in the exact format expected
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

      return stream;
    },
  };
};
