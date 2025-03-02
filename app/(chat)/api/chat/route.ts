// File: /app/(chat)/api/chat/route.ts
import {
  type Message,
  convertToCoreMessages,
} from 'ai';
import { z } from 'zod';

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

export const maxDuration = 300; // 5 minutes to handle larger PDFs

export async function POST(request: Request) {
  console.log('=== API Route Started ===');
  
  const body = await request.json();
  console.log('Request body:', body);
  
  const { id, messages, modelId } = body;

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const model = models.find((model) => model.id === modelId);

  if (!model) {
    return new Response('Model not found', { status: 404 });
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, userId: session.user.id, title });
  }

  await saveMessages({
    messages: [
      { ...userMessage, id: generateUUID(), createdAt: new Date(), chatId: id },
    ],
  });

  console.log('Preparing message for Claude with attachments');

  // Convert to Claude's multimodal format
  const formattedMessages = messages.map((message: Message) => {
    if (message.experimental_attachments?.length) {
      return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content: [
          ...message.experimental_attachments.map(attachment => ({
            type: 'document',
            source: {
              type: 'url',
              media_type: attachment.contentType,
              url: attachment.url
            }
          })),
          {
            type: 'text',
            text: message.content
          }
        ]
      };
    } else {
      return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content
      };
    }
  });

  console.log('Creating stream response with formatted messages:', 
    JSON.stringify(formattedMessages.slice(-2), null, 2));

  try {
    const response = await customModel(model.apiIdentifier).invoke({
      messages: formattedMessages,
      options: { system: systemPrompt }
    });

    console.log('Stream created, sending response');
    const streamResponse = new Response(response, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

    console.log('Response headers:', Object.fromEntries(streamResponse.headers.entries()));
    return streamResponse;
  } catch (error) {
    console.error('Error invoking Claude model:', error);
    return new Response(JSON.stringify({ error: 'Failed to process with Claude' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
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