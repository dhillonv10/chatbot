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
  
  const requiredFields = ['id', 'role', 'content', 'createdAt'];
  return requiredFields.every(field => field in data);
}

function inspectSSE(data: string) {
  console.log('=== SSE Inspection ===');
  console.log('Raw data length:', data.length);
  
  // Sanitize the data before processing
  const sanitizedData = data.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                           .replace(/\u2028/g, '\\n')
                           .replace(/\u2029/g, '\\n');
  
  console.log('Sanitized data:', sanitizedData);
  
  try {
    // Handle the [DONE] message specially
    if (sanitizedData.includes('[DONE]')) {
      return true;
    }
    
    // Remove the SSE prefix and any extra whitespace
    const jsonPart = sanitizedData.replace(/^data:\s*/, '').trim();
    if (!jsonPart) {
      console.error('Empty JSON part after sanitization');
      return false;
    }
    
    const parsed = JSON.parse(jsonPart);
    if (!validateChunkData(parsed)) {
      console.error('Invalid chunk data structure:', parsed);
      return false;
    }
    
    console.log('Successfully parsed JSON:', parsed);
    return true;
  } catch (e: unknown) {
    console.error('Failed to parse JSON:', e);
    console.error('Error details:', {
      message: e instanceof Error ? e.message : String(e),
      data: sanitizedData
    });
    return false;
  }
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
                  const newText = chunk.delta.text.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                                                .replace(/\u2028/g, '\\n')
                                                .replace(/\u2029/g, '\\n');
                  
                  fullContent += newText;
                  console.log('Updated full content length:', fullContent.length);
                  
                  const chunkData = {
                    id: messageId,
                    role: 'assistant' as const,
                    content: fullContent.trim(),
                    createdAt: new Date().toISOString()
                  };

                  if (!validateChunkData(chunkData)) {
                    console.error('Invalid chunk data structure:', chunkData);
                    continue;
                  }

                  const payload = JSON.stringify(chunkData);
                  const sseData = `data: ${payload}\n\n`;
                  
                  console.log('Preparing to send SSE data');
                  const isValid = inspectSSE(sseData);
                  
                  if (!isValid) {
                    console.error('Invalid SSE data detected, skipping chunk');
                    continue;
                  }
                  
                  controller.enqueue(encoder.encode(sseData));
                  console.log('Successfully enqueued chunk');
                } catch (error: unknown) {
                  console.error('Error processing chunk:', error instanceof Error ? error.message : String(error));
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
