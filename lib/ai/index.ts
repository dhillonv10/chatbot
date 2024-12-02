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
      const stream = new ReadableStream({
        async start(controller) {
          console.log('Stream start called');
          try {
            let content = '';
            // Send the initial JSON structure
            const initialJSON = '{"id":"message_1","role":"assistant","content":"';
            console.log('Sending initial JSON structure:', initialJSON);
            controller.enqueue(encoder.encode(initialJSON));
            
            for await (const chunk of response) {
              console.log('Raw chunk received:', JSON.stringify(chunk));
              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                content += chunk.delta.text;
                const encodedChunk = encoder.encode(chunk.delta.text);
                console.log('Sending chunk:', {
                  text: chunk.delta.text,
                  byteLength: encodedChunk.byteLength,
                  content: content.length
                });
                controller.enqueue(encodedChunk);
              } else {
                console.log('Skipping chunk due to type or missing text:', chunk.type);
              }
            }
            console.log('Stream complete, final content length:', content.length);
            // Close the JSON structure
            const closeJSON = '"}';
            console.log('Sending close JSON structure:', closeJSON);
            controller.enqueue(encoder.encode(closeJSON));
            controller.close();
            console.log('Stream controller closed');
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
