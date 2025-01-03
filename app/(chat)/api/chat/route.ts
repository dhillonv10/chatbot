// app/(chat)/api/chat/route.ts
import { type Message } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/lib/ai';
import { models } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import { Attachment as ChatAttachment } from '@/types/chat';
import { Attachment as UIAttachment } from '@ai-sdk/ui-utils'; // Import from the main module

export const maxDuration = 60;

interface ChatMessage extends Omit<Message, 'experimental_attachments'> {
  experimental_attachments?: ChatAttachment[];
}

// Create a new interface that extends UIAttachment and includes the base64 property
interface CustomAttachment extends UIAttachment {
  base64: string;
}

export async function POST(request: Request) {
  const { id, messages, modelId } = await request.json();
  
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const model = models.find((model) => model.id === modelId);
  if (!model) {
    return new Response('Model not found', { status: 404 });
  }

  const formattedMessages = (messages as ChatMessage[]).map((message: ChatMessage) => {
    if (!message.experimental_attachments?.length) {
      return {
        role: message.role,
        content: message.content
      };
    }

    // Convert ChatAttachment to CustomAttachment
    const customAttachments = message.experimental_attachments.map((attachment: ChatAttachment) => ({
      url: '', // Add an empty url property to satisfy the UIAttachment interface
     ...attachment,
    } as CustomAttachment));

    return {
      role: message.role,
      content: [
       ...customAttachments.map(attachment => ({
          type: 'image',
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

  const response = await customModel(model.apiIdentifier).invoke({
    messages: formattedMessages,
    options: systemPrompt
  });

  return new Response(response, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}