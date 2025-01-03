import { Message } from '@/types/chat';
import { Anthropic } from '@anthropic-ai/sdk';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: Request) {
  const { messages } = await request.json();
  
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formattedMessages = messages.map((message: Message) => {
    if (!message.experimental_attachments?.length) {
      return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content
      };
    }

    // Handle messages with PDF attachments
    return {
      role: message.role === 'user' ? 'user' : 'assistant',
      content: [
        ...message.experimental_attachments.map(attachment => ({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: attachment.base64
          }
        })),
        {
          type: 'text',
          text: message.content
        }
      ]
    };
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4096,
      messages: formattedMessages,
      system: systemPrompt
    });

    return new Response(response.content[0].text, {
      headers: {
        'Content-Type': 'text/plain',
      }
    });
  } catch (error) {
    console.error('Error calling Claude API:', error);
    return new Response('Error processing request', { status: 500 });
  }
}