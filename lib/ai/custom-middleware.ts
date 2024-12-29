import { type Message } from 'ai';
import type { Message as AnthropicMessage } from '@anthropic-ai/sdk';

export async function formatMessageForClaude(message: Message): Promise<AnthropicMessage> {
  if (!message.experimental_attachments) {
    return { 
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.content 
    };
  }

  // Handle messages with attachments
  const pdfAttachment = message.experimental_attachments.find(
    att => att.contentType === 'application/pdf'
  );

  if (pdfAttachment) {
    console.log('=== FORMATTING PDF FOR CLAUDE ===');
    // Fetch the PDF content
    const response = await fetch(pdfAttachment.url);
    const pdfBuffer = await response.arrayBuffer();
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

    return {
      role: 'user',
      content: [
        {
          type: 'text',
          text: message.content as string
        },
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Pdf
          }
        }
      ]
    };
  }

  return {
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.content
  };
}
