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
                
                // Format exactly as Vercel AI SDK expects
                const aiMessage = {
                  id: messageId,
                  role: 'assistant' as const,
                  content: fullContent,
                  createdAt: new Date(),
                };

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(aiMessage)}\n\n`)
                );
              } else if (chunk.type === 'message_stop') {
                controller.enqueue(
                  encoder.encode('data: [DONE]\n\n')
                );
                break;
              }
            }
            controller.close();
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
