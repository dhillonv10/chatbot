import { AnthropicStream } from '@/lib/ai';
import { models } from '@/lib/ai/models';
import { prompts } from '@/lib/ai/prompts';
import { auth } from '@/auth';
import { kv } from '@vercel/kv';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/redis';

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { messages, previewToken } = json;
    const userId = (await auth())?.user.id;

    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Rate limiting
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 d')
    });

    const { success } = await ratelimit.limit(userId);
    if (!success) {
      return new Response('Too Many Requests', { status: 429 });
    }

    // Add default message if conversation is empty
    if (messages.length === 0) {
      messages.push({
        role: 'assistant',
        content: prompts.defaultMessage
      });
    }

    const response = await AnthropicStream(messages, models.claude.id);
    
    // Store conversation history
    if (userId) {
      const timestamp = Date.now();
      const id = messages[0]?.id ?? `message-${timestamp}`;
      
      await kv.hset(`chat:${id}`, {
        id,
        userId,
        messages,
        timestamp
      });
    }

    return response;
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(prompts.errorMessage, { status: 500 });
  }
}