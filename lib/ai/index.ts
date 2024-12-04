import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Helper function to inspect SSE data
function inspectSSE(data: string) {
  console.log('=== SSE Inspection ===');
  console.log('Raw data length:', data.length);
  console.log('Raw data:', data);
  console.log('Hex representation:', Buffer.from(data).toString('hex'));
  console.log('Has correct newlines:', data.endsWith('\n\n'));
  try {
    const jsonPart = data.replace('data: ', '').trim();
    const parsed = JSON.parse(jsonPart);
    console.log('Successfully parsed JSON:', parsed);
    return true;
  } catch (e) {
    console.error('Failed to parse JSON:', e);
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
                fullContent += chunk.delta.text;
                console.log('Updated full content:', fullContent);
                
                const chunkData = {
                  id: messageId,
                  role: 'assistant',
                  content: fullContent,
                  createdAt: new Date().toISOString(),
                };

                console.log('Created chunk data:', chunkData);
                
                const payload = JSON.stringify(chunkData);
                const sseData = `data: ${payload}\n\n`;
                
                console.log('Preparing to send SSE data:');
                const isValid = inspectSSE(sseData);
                console.log('SSE data is valid:', isValid);

                controller.enqueue(encoder.encode(sseData));
                console.log('Enqueued chunk');
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
