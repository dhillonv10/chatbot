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

      console.log('Got response from Anthropic, creating stream');

      const encoder = new TextEncoder();
      let streamClosed = false; // Track stream closure to avoid multiple close calls

      const stream = new ReadableStream({
        async start(controller) {
          console.log('Stream start called');
          try {
            let content = '';
            for await (const chunk of response) {
              if (streamClosed) {
                console.warn('Stream already closed. Ignoring chunk:', chunk);
                continue;
              }

              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                content += chunk.delta.text;
                console.log('Accumulated content so far:', content);

                // Format as a proper AI message
                const message = {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: content,
                  createdAt: new Date().toISOString()
                };

                // Send as SSE data
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
              } else if (chunk.type === 'message_stop') {
                console.log('Received message_stop chunk; closing stream.');
                // Send final [DONE] event
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                streamClosed = true;
                controller.close();
              }
            }
          } catch (error) {
            console.error('Stream processing error:', error);
            // Send error as SSE data
            const errorMessage = {
              id: Date.now().toString(),
              role: 'assistant',
              content: 'An error occurred while processing the response.',
              createdAt: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
            controller.error(error);
          }
        }
      });

      return stream;
    },
  };
};
