import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '' // Handle empty string case for Vercel env
});

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      // Format messages with explicit type literals
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      console.log('Starting API call with messages:', messages);
      const response = await anthropic.messages.create({
        model: apiIdentifier,
        messages: formattedMessages,
        system: options?.system,
        max_tokens: 4096,
        stream: true
      });

      console.log('Got response from Anthropic, creating stream');
      
      // Convert to a ReadableStream
      const encoder = new TextEncoder();
      let counter = 0;
      
      const stream = new ReadableStream({
        async start(controller) {
          console.log('Stream start called');
          try {
            let content = '';
            
            for await (const chunk of response) {
              console.log('Raw chunk received:', JSON.stringify(chunk, null, 2));
              
              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                content += chunk.delta.text;
                
                // Format exactly as the ai package expects
                const message = {
                  id: `message_${counter}`,
                  role: 'assistant' as const,
                  content,
                  createdAt: new Date(),
                  name: undefined,
                  function_call: undefined,
                };
                
                console.log('Sending chunk:', {
                  chunkLength: chunk.delta.text.length,
                  totalLength: content.length,
                  preview: content.slice(-50)
                });

                const payload = `data: ${JSON.stringify(message)}\n\n`;
                controller.enqueue(encoder.encode(payload));
                counter++;
              } else {
                console.log('Skipping non-text chunk:', chunk.type);
              }
            }
            
            // Send completion
            console.log('Sending completion signal');
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            console.log('Stream closed. Final content length:', content.length);
          } catch (error) {
            console.error('Stream error:', error);
            if (error instanceof Error) {
              console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
              });
            } else {
              console.error('Unknown error type:', error);
            }
            controller.error(error);
          }
        }
      });

      console.log('Stream created, returning to client');
      
      return stream;
    }
  };
};
