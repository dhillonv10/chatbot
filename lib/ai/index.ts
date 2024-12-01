import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const customModel = (apiIdentifier: string) => {
  return async function* (messages: Array<{ role: string; content: string }>, options: { system?: string } = {}) {
    const response = await anthropic.messages.create({
      model: apiIdentifier,
      messages: messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
      stream: true,
      max_tokens: 4096,
      system: options.system,
    });

    for await (const chunk of response) {
      if (chunk.type === 'content_block_delta') {
        yield chunk.delta.text;
      }
    }
  };
};
