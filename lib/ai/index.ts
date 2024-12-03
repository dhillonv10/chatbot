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

      try {
        const response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: formattedMessages,
          system: options?.system,
          max_tokens: 4096,
          stream: true,
        });

        console.log('Got response from Anthropic, creating stream');

        // Create a stream that emits SSE formatted messages
        return new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            let messageId = Date.now().toString();
            let content = '';

            try {
              for await (const chunk of response) {
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  content += chunk.delta.text;
                  
                  const message = {
                    id: messageId,
                    role: 'assistant',
                    content: content,
                  };

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
                }
              }
              // Send the done message and close
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (error) {
              console.error('Stream processing error:', error);
              controller.error(error);
            }
          }
        });
      } catch (error) {
        console.error('Error during API call to Anthropic:', error);
        throw new Error('Failed to call Anthropic API');
      }
    },
  };
};
