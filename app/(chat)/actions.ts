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
    model: 'claude-3-5-sonnet-20241022',
    system: `
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    messages: [{ role: 'user', content: JSON.stringify(message) }],
    max_tokens: 100,
  });

  return response.content[0].text;
}
