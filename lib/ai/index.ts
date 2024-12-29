import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { formatMessageForClaude } from './custom-middleware';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      console.log('=== Starting new chat invocation ===');
      console.log('Input messages:', messages);
      
      try {
        // Format messages with attachment handling
        const formattedMessages = await Promise.all(
          messages.map(msg => formatMessageForClaude(msg))
        );

        console.log('Formatted messages for Claude:', formattedMessages);
        
        // Check if we have a PDF in the messages
        const hasPDF = messages.some(msg => msg.experimental_attachments?.some(
          att => att.contentType === 'application/pdf'
        ));

        let response;

        if (hasPDF) {
          // Make direct API call for PDF messages
          console.log('PDF detected, making direct API call');
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY || '',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: apiIdentifier,
              messages: formattedMessages,
              system: options?.system,
              max_tokens: 4096,
              stream: true
            })
          });
        } else {
          // Use SDK for non-PDF messages
          response = await anthropic.messages.create({
            model: apiIdentifier,
            messages: formattedMessages,
            system: options?.system,
            max_tokens: 4096,
            stream: true,
          });
        }
        
        console.log('Successfully created Anthropic stream');

        const encoder = new TextEncoder();
        let streamClosed = false;

        const stream = new ReadableStream({
          async start(controller) {
            try {
              let fullContent = '';
              const messageId = crypto.randomUUID();
              console.log('Generated message ID:', messageId);

              if (hasPDF) {
                // Handle raw fetch response
                const reader = response.body?.getReader();
                if (!reader) throw new Error('No reader available');

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = new TextDecoder().decode(value);
                  const lines = chunk.split('\n');

                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const data = JSON.parse(line.slice(6));
                      if (data.type === 'content_block_delta' && data.delta?.text) {
                        fullContent += data.delta.text;
                        const chunkData = {
                          id: messageId,
                          role: 'assistant',
                          content: fullContent,
                          createdAt: new Date().toISOString()
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
                      }
                    }
                  }
                }
              } else {
                // Handle SDK response
                for await (const chunk of response) {
                  if (streamClosed) break;

                  if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                    fullContent += chunk.delta.text;
                    const chunkData = {
                      id: messageId,
                      role: 'assistant',
                      content: fullContent,
                      createdAt: new Date().toISOString()
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
                  }
                }
              }

              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
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
      } catch (error) {
        console.error('Error during API call to Anthropic:', error);
        throw error;
      }
    },
  };
};
