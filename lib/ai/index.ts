// File: /lib/ai/index.ts
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

// Define interfaces for multimodal message types
interface TextContent {
  type: 'text';
  text: string;
}

interface DocumentContent {
  type: 'document';
  source: {
    type: 'url';
    media_type: string;
    url: string;
  };
}

type ContentPart = TextContent | DocumentContent;

interface MultimodalMessage {
  role: 'user' | 'assistant';
  content: string | ContentPart[];
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
    async invoke({ messages, options }: { messages: MultimodalMessage[]; options?: { system?: string } }) {
      console.log('=== Starting new chat invocation ===');
      console.log('Input messages length:', messages.length);
      console.log('Last message sample:', JSON.stringify(messages[messages.length - 1]).substring(0, 500) + '...');
      
      // No conversion needed here as we're now passing the correctly formatted messages
      // directly from the API route
      
      console.log('Sending request to Anthropic API with model:', apiIdentifier);
      
      let response;
      try {
        response = await anthropic.messages.create({
          model: apiIdentifier,
          messages: messages,
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
                  const payload = JSON.stringify(chunkData);
                  controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
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