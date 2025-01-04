import { Message } from '@/types/chat';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: Request) {
  const { messages, modelId } = await request.json();
  
  const formattedMessages = messages.map((message) => {
    if (message.experimental_attachments?.length) {
      return {
        role: message.role,
        content: message.content,
        experimental_attachments: message.experimental_attachments.map((attachment) => ({
          type: "document",
          source: {
            type: "base64",
            media_type: attachment.contentType,
            data: attachment.data, // Assuming base64 encoding is already handled during upload.
          },
        })),
      };
    }
    return {
      role: message.role,
      content: message.content,
    };
  });

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    messages: formattedMessages
  });

  return new Response(response.content[0].text, {
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}
