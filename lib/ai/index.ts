import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '' // Handle empty string case for Vercel env
});

interface SimplifiedMessage {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      // Convert complex messages to simplified format
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: typeof msg.content === 'string' 
          ? msg.content 
          : Array.isArray(msg.content) && msg.content.length > 0 && 'text' in msg.content[0]
            ? msg.content[0].text as string
            : ''
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
            let fullContent = '';
            
            // Send the start of the message
            controller.enqueue(encoder.encode('data: '));
            
            for await (const chunk of response) {
              console.log('Processing chunk:', chunk);
              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                fullContent += chunk.delta.text;
                console.log('Accumulated content:', fullContent);
                
                // Format each chunk as a complete message
                const message = {
                  id: 'message_1',
                  role: 'assistant',
                  content: fullContent
                };
                
                controller.enqueue(encoder.encode(JSON.stringify(message) + '\n\n'));
              }
            }
            
            console.log('Stream complete, final content:', fullContent);
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Stream error:', error);
            controller.error(error);
          }
        }
      });

      return stream;
    }
  };
};
