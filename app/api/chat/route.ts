// File: /app/api/chat/route.ts
import { NextResponse } from 'next/server';

interface Attachment {
  type: string;
  source: {
    type: string;
    media_type: string;
    data: string;
  };
}

interface Message {
  role: string;
  content: string;
  experimental_attachments?: Attachment[];
}

export async function POST(request: Request) {
  try {
    const { messages, modelId }: { messages: Message[]; modelId: string } = await request.json();

    const formattedMessages = messages.map((message) => {
      if (message.experimental_attachments?.length) {
        return {
          role: message.role,
          content: [
            ...message.experimental_attachments.map((attachment) => ({
              type: 'document',
              source: {
                type: 'base64',
                media_type: attachment.source.media_type,
                data: attachment.source.data,
              },
            })),
            {
              type: 'text',
              text: message.content,
            },
          ],
        };
      }

      return {
        role: message.role,
        content: message.content,
      };
    });

    // Simulating sending the formatted messages to the Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1024,
        messages: formattedMessages,
      }),
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing chat request:', error);
    return NextResponse.json({ error: 'Failed to process chat request.' }, { status: 500 });
  }
}
