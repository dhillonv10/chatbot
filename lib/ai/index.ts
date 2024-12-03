import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { experimental_StreamData, createStreamDataTransformer } from 'ai';

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

        // Create a TransformStream to handle the response
        const data = new experimental_StreamData();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of response) {
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  // Send the chunk as a UI message
                  controller.enqueue(
                    new TextEncoder().encode(
                      JSON.stringify({
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: chunk.delta.text,
                      }) + '\n'
                    )
                  );
                }
              }
              // End the stream
              controller.close();
            } catch (error) {
              console.error('Stream processing error:', error);
              controller.error(error);
            }
          },
        });

        // Transform the stream using Vercel's utility
        return stream.pipeThrough(createStreamDataTransformer(data));
      } catch (error) {
        console.error('Error during API call to Anthropic:', error);
        throw new Error('Failed to call Anthropic API');
      }
    },
  };
};
