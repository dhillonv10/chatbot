import {
  type Message,
  convertToCoreMessages,
} from 'ai';
import { z } from 'zod';
import { Attachment } from '@/types/chat';

import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/lib/ai';
import { models } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
} from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';

export const maxDuration = 60;

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

  // Handle attachments if present
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.experimental_attachments) {
    const attachmentUrls = lastMessage.experimental_attachments.map(
      (attachment: Attachment) => attachment.url
    );
    
    // Add attachment context to the message
    lastMessage.content += `\n\nI've attached the following PDFs: ${attachmentUrls.join(', ')}`;
  }

  const response = await customModel(model.apiIdentifier).invoke({
    messages,
    options: { system: systemPrompt }
  });

  return new Response(response, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!id) {
    return new Response('Missing chat ID', { status: 400 });
  }

  await deleteChatById({ id });

  return new Response('OK');
}