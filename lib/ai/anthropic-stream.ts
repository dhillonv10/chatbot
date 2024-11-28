import { StreamingTextResponse } from 'ai';
import { experimental_StreamData } from 'ai';
import Anthropic from '@anthropic-ai/sdk';
import { prompts } from './prompts';

export async function AnthropicStream(
  messages: { content: string; role: 'user' | 'assistant' }[],
  model: string = 'claude-2'
) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  // Add system message if not present
  if (messages[0]?.role !== 'system') {
    messages.unshift({
      role: 'system',
      content: prompts.systemMessage
    });
  }

  try {
    const response = await anthropic.messages.create({
      model: model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: true,
      max_tokens: 4096,
      temperature: 0.7
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        for await (const chunk of response) {
          if (chunk.type === 'content_block_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      }
    });

    const data = new experimental_StreamData();

    return new StreamingTextResponse(stream, { headers: data.headers });
  } catch (error) {
    console.error('Anthropic API Error:', error);
    throw error;
  }
}