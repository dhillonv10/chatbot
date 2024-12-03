import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

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
        const stream = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          })),
          system: options?.system,
          stream: true,
        });

        const textEncoder = new TextEncoder();
        let counter = 0;

        const transformStream = new TransformStream({
          async transform(chunk, controller) {
            if (chunk.type === 'content_block_delta' && chunk.delta.text) {
              const payload = {
                id: String(counter++),
                role: 'assistant',
                content: chunk.delta.text,
                createdAt: new Date().toISOString()
              };
              controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            }
          },
          flush(controller) {
            controller.enqueue(textEncoder.encode('data: [DONE]\n\n'));
          }
        });

        return new Response((stream as any).pipeThrough(transformStream), {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });

      } catch (error) {
        console.error('Claude API invocation error:', error);
        return new Response(JSON.stringify({ error: 'Failed to generate response' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },
  };
};
