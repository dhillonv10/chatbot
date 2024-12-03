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
      const stream = new ReadableStream({
        async start(controller) {
          console.log('Stream start called');
          try {
            const initialMessage = {
              id: Date.now().toString(),
              role: 'assistant',
              content: '',
              createdAt: new Date(),
            };

            controller.enqueue(encoder.encode(JSON.stringify(initialMessage) + '\n'));

            let content = '';
            for await (const chunk of response) {
              console.log('Processing chunk:', JSON.stringify(chunk, null, 2));

              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                content += chunk.delta.text;
                console.log('Accumulated content so far:', content);

                const deltaMessage = {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: chunk.delta.text,
                  createdAt: new Date(),
                };

                try {
                  const deltaString = JSON.stringify(deltaMessage);
                  controller.enqueue(encoder.encode(deltaString + '\n'));
                } catch (err) {
                  console.error('JSON Stringify Error:', err, deltaMessage);
                  controller.error(err);
                }
              } else if (chunk.type === 'message_stop') {
                console.log('Received message_stop chunk; signaling stream end.');
                controller.close();
                break;
              } else if (chunk.type === 'content_block_start' || chunk.type === 'message_start') {
                console.log('Received chunk type to be ignored:', chunk.type);
              } else {
                console.warn('Unexpected chunk format:', JSON.stringify(chunk, null, 2));
              }
            }

            console.log('Stream complete, final content:', content);
            controller.close();
          } catch (error) {
            console.error('Error during streaming:', error);
            controller.error(error);
          }
        },
      });

      return stream;
    },
  };
};
