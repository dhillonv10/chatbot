import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '', // Handle empty string case for Vercel env
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

      console.log('Starting API call with messages:', JSON.stringify(formattedMessages, null, 2));
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
            let content = '';
            for await (const chunk of response) {
              if (streamClosed) break;

              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                content += chunk.delta.text;
                
                const message = {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: content,
                  createdAt: new Date(),
                };

                controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
              } else if (chunk.type === 'message_stop') {
                if (!streamClosed) {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  streamClosed = true;
                  controller.close();
                }
              }
            }

            if (!streamClosed) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          } catch (error) {
            console.error('Error during streaming:', error);
            if (!streamClosed) {
              controller.error(error);
            }
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
