import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { formatMessageForClaude } from './custom-middleware';

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
      console.log('=== Starting new chat invocation ===');
      console.log('Input messages:', messages);
      
      // Format messages with attachment handling
      const formattedMessages = await Promise.all(
        messages.map(msg => formatMessageForClaude(msg))
      );

      console.log('Formatted messages for Anthropic:', formattedMessages);
      
      let response;
      try {
        response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: formattedMessages,
          system: options?.system,
          max_tokens: 4096,
          stream: true,
        });
        console.log('Successfully created Anthropic stream');
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
            console.log('Generated message ID:', messageId);

            for await (const chunk of response) {
              if (streamClosed) break;

              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                try {
                  fullContent += chunk.delta.text;
                  const chunkData = {
                    id: messageId,
                    role: 'assistant',
                    content: fullContent,
                    createdAt: new Date().toISOString()
                  };
                  const payload = JSON.stringify(chunkData);
                  controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
                } catch (error) {
                  console.error('Chunk processing error:', error);
                  continue;
                }
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

      return stream;
    },
  };
};
