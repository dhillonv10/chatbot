// File: /lib/ai/index.ts
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface AIStreamChunk {
  id: string;
  role: 'assistant';
  content: string;
  createdAt: string;
}

function createChunk(messageId: string, content: string): AIStreamChunk {
  return {
    id: messageId,
    role: 'assistant',
    content,  
    createdAt: new Date().toISOString()
  };
}

// Helper function to safely encode content for SSE
function encodeSSEMessage(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { 
      messages: any[]; 
      options?: { system?: string } 
    }) {
      console.log('=== Starting new chat invocation ===');
      console.log('Input messages length:', messages.length);
      console.log('Last message:', JSON.stringify(messages[messages.length - 1]));
      
      // Validate that the messages are properly formatted before sending to Anthropic
      const validMessages = messages.map(msg => {
        if (Array.isArray(msg.content)) {
          // Already in multimodal format
          return msg;
        } else {
          // Convert to standard format
          return {
            role: msg.role,
            content: msg.content
          };
        }
      });
      
      console.log('Sending request to Anthropic API with model:', apiIdentifier);
      
      let response;
      try {
        response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: validMessages,
          system: options?.system,
          max_tokens: 4096,
          stream: true,
        });
        console.log('Successfully created Anthropic stream');
      } catch (error) {
        console.error('Error during API call to Anthropic:', error);
        throw new Error('Failed to call Anthropic API');
      }

      const encoder = new TextEncoder();
      let streamClosed = false;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullContent = '';
            const messageId = crypto.randomUUID();
            console.log('Generated message ID:', messageId);

            for await (const chunk of response) {
              if (streamClosed) break;

              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                try {
                  fullContent += chunk.delta.text;
                  const chunkData = createChunk(messageId, fullContent);
                  controller.enqueue(encoder.encode(encodeSSEMessage(chunkData)));
                } catch (error) {
                  console.error('Chunk processing error:', error);
                  continue;
                }
              } else if (chunk.type === 'message_stop') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                break;
              }
            }
          } catch (error) {
            console.error('Stream error:', error);
            controller.error(error);
          }
        },
        cancel() {
          streamClosed = true;
        },
      });

      return stream;
    },
  };
};