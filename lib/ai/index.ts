import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Helper function to inspect SSE data
function validateChunkData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  
  // Check required fields exist and have correct types
  const fields = {
    id: 'string',
    role: 'string',
    content: 'string',
    createdAt: 'string'
  };
  
  return Object.entries(fields).every(([field, type]) => {
    const value = (data as any)[field];
    return value !== undefined && typeof value === type;
  });
}

function inspectSSE(data: string) {
  try {
    // Handle special cases
    if (data.includes('[DONE]')) return true;
    if (!data.startsWith('data: ')) return false;
    
    // Extract JSON part, being more lenient with the ending
    const jsonStart = data.indexOf('{');
    const jsonEnd = data.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.error('Invalid JSON boundaries in SSE data');
      return false;
    }
    
    const jsonStr = data.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonStr);
    
    if (!validateChunkData(parsed)) {
      console.error('Invalid chunk structure:', parsed);
      return false;
    }
    
    return true;
  } catch (e: unknown) {
    console.error('SSE parse error:', {
      error: e instanceof Error ? e.message : String(e),
      data: data
    });
    return false;
  }
}

// Helper to safely encode content for SSE
function encodeContent(content: string): string {
  return content
    .replace(/\\/g, '\\\\')   // Escape backslashes first
    .replace(/\n/g, '\\n')    // Then escape newlines
    .replace(/\r/g, '\\r')    // Then carriage returns
    .replace(/\t/g, '\\t')    // Then tabs
    .replace(/"/g, '\\"');    // Then quotes
}

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      console.log('=== Starting new chat invocation ===');
      console.log('Input messages:', messages);
      
      const formattedMessages = messages.map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.content,
      }));

      console.log('Formatted messages for Anthropic:', formattedMessages);
      
      let response;
      try {
        response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: formattedMessages,
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
          console.log('=== Stream started ===');
          try {
            let fullContent = '';
            const messageId = crypto.randomUUID();
            console.log('Generated message ID:', messageId);

            for await (const chunk of response) {
              console.log('Received chunk:', chunk);
              
              if (streamClosed) {
                console.log('Stream is closed, breaking');
                break;
              }

              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                try {
                  // Normalize line endings and remove control characters
                  const newText = chunk.delta.text
                    .replace(/\r\n/g, '\n')
                    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
                    .replace(/\u2028|\u2029/g, '\n');
                  
                  fullContent += newText;
                  
                  // Create the chunk data with properly encoded content
                  const chunkData = {
                    id: messageId,
                    role: 'assistant' as const,
                    content: encodeContent(fullContent.trim()),
                    createdAt: new Date().toISOString()
                  };

                  // Convert to SSE format
                  const payload = JSON.stringify(chunkData);
                  const sseData = `data: ${payload}\n\n`;
                  
                  if (!inspectSSE(sseData)) {
                    console.error('SSE validation failed:', {
                      sseData,
                      payload,
                      chunkData
                    });
                    continue;
                  }
                  
                  controller.enqueue(encoder.encode(sseData));
                } catch (error: unknown) {
                  console.error('Chunk processing error:', {
                    error: error instanceof Error ? error.message : String(error),
                    chunk: chunk.delta.text,
                    fullContent
                  });
                  continue;
                }
              } else if (chunk.type === 'message_stop') {
                console.log('Received message_stop, sending DONE');
                const doneMessage = 'data: [DONE]\n\n';
                console.log('DONE message:', doneMessage);
                controller.enqueue(encoder.encode(doneMessage));
                controller.close();
                console.log('Stream closed');
                break;
              }
            }
          } catch (error: unknown) {
            console.error('=== Stream error ===');
            console.error('Error details:', error);
            if (error instanceof Error) {
              console.error('Error name:', error.name);
              console.error('Error message:', error.message);
              console.error('Error stack:', error.stack);
            } else {
              console.error('Unknown error type:', typeof error);
            }
            controller.error(error);
          }
        },
        cancel() {
          console.log('Stream cancelled');
          streamClosed = true;
        },
      });

      return stream;
    },
  };
};
