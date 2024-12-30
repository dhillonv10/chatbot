import { Message } from '@/types/chat';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: Request) {
  const { messages, modelId } = await request.json();
  
  const formattedMessages = messages.map((message: Message) => {
    if (!message.experimental_attachments?.length) {
      return {
        role: message.role,
        content: message.content
      };
    }

    return {
      role: message.role,
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

  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 4096,
    messages: formattedMessages
  });

  return new Response(response.content[0].text, {
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}
