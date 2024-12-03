import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { StreamingTextResponse, experimental_StreamData } from 'ai';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '', // Handle empty string case for Vercel env
});

// Extend the LanguageModelV1 type to include the required model
type LanguageModelV1 = 'claude-3-5-sonnet-20241022'; // Extend this with additional models as needed

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }): Promise<Response> {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          })),
          system: options?.system,
          stream: true,
        });

        // Create a new experimental stream data instance
        const data = new experimental_StreamData();

        // Convert the response into a friendly stream
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            let counter = 0;

            try {
              for await (const chunk of response) {
                if (chunk.type === 'content_block_delta') {
                  const text = chunk.delta?.text || '';
                  if (text) {
                    const message = {
                      id: counter++,
                      role: 'assistant',
                      content: text,
                      createdAt: new Date().toISOString()
                    };
                    
                    controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
                  }
                }
              }
              controller.close();
            } catch (error) {
              console.error('Stream processing error:', error);
              controller.error(error);
            }
          }
        });

        // Return the stream response
        return new StreamingTextResponse(stream, {}, data);

      } catch (error) {
        console.error('Anthropic API Error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to generate response' }), 
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    },
  };
};
