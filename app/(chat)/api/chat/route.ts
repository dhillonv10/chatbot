import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

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
  console.log('=== API Route Started ===');
  
  const body = await request.json();
  console.log('Request body:', {
    id: body.id,
    modelId: body.modelId,
    messageCount: body.messages?.length,
    lastMessage: body.messages?.[body.messages?.length - 1]
  });
  
  const { id, messages, modelId } = body;

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const model = models.find((model) => model.id === modelId);

  if (!model) {
    console.error('Model not found:', modelId);
    return new Response('Model not found', { status: 404 });
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    console.error('No user message found in request');
    return new Response('No user message found', { status: 400 });
  }

  console.log('Processing user message:', {
    role: userMessage.role,
    content: userMessage.content,
    attachments: userMessage.attachments
  });

  const chat = await getChatById({ id });

  if (!chat) {
    console.log('Creating new chat...');
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, userId: session.user.id, title });
  }

  await saveMessages({
    messages: [
      { ...userMessage, id: generateUUID(), createdAt: new Date(), chatId: id },
    ],
  });

  console.log('Creating stream response with model:', model.apiIdentifier);
  const response = await customModel(model.apiIdentifier).invoke({
    messages,
    options: { system: systemPrompt }
  });

  console.log('Stream created, sending response');
  const streamResponse = new Response(response, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked'
    },
  });

  console.log('Response headers:', Object.fromEntries(streamResponse.headers.entries()));
  return streamResponse;
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

  console.log('Deleting chat:', id);
  await deleteChatById({ id });

  return new Response('OK');
}
