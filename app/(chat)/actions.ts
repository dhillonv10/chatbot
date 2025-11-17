'use server';

import { type CoreUserMessage } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { cookies } from 'next/headers';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function saveModelId(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('model-id', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: CoreUserMessage;
}) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    system: `
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    messages: [{ role: 'user', content: JSON.stringify(message) }],
    max_tokens: 100,
  });

  // Handle different content block types from newer SDK
  const firstBlock = response.content[0];
  if (firstBlock.type === 'text') {
    return firstBlock.text;
  }

  // Fallback if first block is not text (shouldn't happen with this prompt)
  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : 'New Conversation';
}
