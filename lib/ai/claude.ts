import { Anthropic } from '@anthropic-ai/sdk';
import { type Message } from 'ai';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function claudeStream(messages: Message[], model: string) {
  const response = await anthropic.messages.create({
    model: model,
    messages: messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    })),
    stream: true,
    max_tokens: 4096,
  });

  return response;
}

export async function claudeCompletion(messages: Message[], model: string) {
  const response = await anthropic.messages.create({
    model: model,
    messages: messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    })),
    max_tokens: 4096,
  });

  return response;
}
