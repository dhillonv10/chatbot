import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
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

        // Create a transform stream to convert chunks to the format expected by useChat
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            let counter = 0;

            try {
              for await (const chunk of response) {
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  const data = {
                    id: String(counter++),
                    role: 'assistant',
                    content: chunk.delta.text,
                    createdAt: new Date().toISOString()
                  };
                  
                  // Format as SSE
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                }
              }
              // Send the [DONE] event
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (error) {
              console.error('Stream processing error:', error);
              controller.error(error);
            }
          }
        });

        // Return the stream with proper headers
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });

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
