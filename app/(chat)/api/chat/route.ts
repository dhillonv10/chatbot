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
  getUserMedicalHistory,
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

  // Fetch the user's medical history
  const medicalHistory = await getUserMedicalHistory(session.user.id);

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

  // Convert to Claude's multimodal format - FIXED VERSION
  const formattedMessages = messages.map((message: Message) => {
    if (message.experimental_attachments?.length) {
      return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content: [
          ...message.experimental_attachments.map(attachment => ({
            type: "document",
            source: {
              type: "url",
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

  // Create a custom system prompt that includes the medical history
  let customSystemPrompt = systemPrompt;
  if (medicalHistory) {
    try {
      const parsedHistory = JSON.parse(medicalHistory);
      const formattedHistory = `
User Medical History (for educational context only):
- Allergies: ${parsedHistory.allergies || 'None reported'}
- Current Medications: ${parsedHistory.medications || 'None reported'}
- Medical Conditions: ${parsedHistory.conditions || 'None reported'}
- Family Medical History: ${parsedHistory.familyHistory || 'None reported'}
      `;
      
      // Add medical history to the system prompt
      customSystemPrompt = `${systemPrompt}\n\n${formattedHistory}`;
    } catch (error) {
      console.error('Error parsing medical history:', error);
      // Continue with the original system prompt if there's an error
    }
  }

  console.log('Creating stream response with formatted messages:', 
    JSON.stringify(formattedMessages.slice(-2), null, 2));

  try {
    const response = await customModel(model.apiIdentifier).invoke({
      messages: formattedMessages,
      options: { system: customSystemPrompt } // Use the customized system prompt
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