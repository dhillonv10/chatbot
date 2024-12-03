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
        console.log('Starting Anthropic API call with messages:', 
          messages.map(m => ({ role: m.role, contentLength: m.content?.length }))
        );

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

        console.log('Anthropic API response received, setting up stream');

        // Create a transform stream to convert chunks to the format expected by useChat
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            let counter = 0;
            let fullContent = '';

            try {
              console.log('Starting to process stream chunks');
              
              for await (const chunk of response) {
                console.log('Received chunk:', {
                  type: chunk.type,
                  hasText: chunk.type === 'content_block_delta' && !!chunk.delta?.text,
                  textLength: chunk.type === 'content_block_delta' ? chunk.delta?.text?.length : 0
                });

                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  const text = chunk.delta.text;
                  fullContent += text;
                  
                  // Ensure code blocks are properly formatted
                  const formattedContent = fullContent
                    .replace(/```(\w+)\n/g, '```$1\n') // Ensure language tags are properly formatted
                    .replace(/```\n/g, '```plaintext\n'); // Add plaintext for code blocks without language
                  
                  const data = {
                    id: String(counter++),
                    role: 'assistant',
                    content: formattedContent,
                    createdAt: new Date().toISOString()
                  };
                  
                  const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
                  console.log('Sending SSE message:', {
                    messageId: data.id,
                    contentLength: data.content.length,
                    sseLength: sseMessage.length
                  });
                  
                  controller.enqueue(encoder.encode(sseMessage));
                }
              }

              console.log('Stream completed, sending DONE event');
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (error: unknown) {
              const err = error as Error;
              console.error('Stream processing error:', {
                name: err?.name,
                message: err?.message,
                stack: err?.stack,
                fullContent
              });
              controller.error(err);
            }
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });

      } catch (error: unknown) {
        const err = error as Error;
        console.error('Anthropic API Error:', {
          name: err?.name,
          message: err?.message,
          stack: err?.stack
        });
        return new Response(
          JSON.stringify({ 
            error: 'Failed to generate response',
            details: err?.message || 'Unknown error'
          }), 
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    },
  };
};
