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
            let messageId: string | undefined;
            
            for await (const chunk of response) {
              console.log('Processing chunk:', chunk);
              
              if (chunk.type === 'message_start') {
                messageId = chunk.message.id;
                const event = {
                  id: messageId,
                  role: 'assistant',
                  content: ''
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } 
              else if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
                content += chunk.delta.text;
                
                // Extract just the actual text content
                let cleanContent = content;
                
                // Handle JSON within code blocks
                cleanContent = cleanContent.replace(/```json\s*{[\s\S]*?}\s*```/g, '');
                
                // Remove any remaining standalone JSON objects
                cleanContent = cleanContent.replace(/{\s*"[^}]*}/g, '');
                
                // Clean up any leftover artifacts
                cleanContent = cleanContent
                  .replace(/```\s*$/g, '') // Remove trailing backticks
                  .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
                  .trim();
                
                const event = {
                  id: messageId || 'message_1',
                  role: 'assistant',
                  content: cleanContent
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              }
              else if (chunk.type === 'message_stop') {
                // Final cleanup of content
                let cleanContent = content;
                cleanContent = cleanContent.replace(/```json\s*{[\s\S]*?}\s*```/g, '');
                cleanContent = cleanContent.replace(/{\s*"[^}]*}/g, '');
                cleanContent = cleanContent
                  .replace(/```\s*$/g, '')
                  .replace(/\n{3,}/g, '\n\n')
                  .trim();
                
                const event = {
                  id: messageId || 'message_1',
                  role: 'assistant',
                  content: cleanContent
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
            }
            
            console.log('Stream complete, final content:', content);
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
