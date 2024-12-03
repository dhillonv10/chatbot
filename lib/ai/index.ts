import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { OpenAIStream, StreamingTextResponse } from 'ai';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '', // Handle empty string case for Vercel env
});

// Extend the LanguageModelV1 type to include the required model
type LanguageModelV1 = 'claude-3-5-sonnet-20241022'; // Extend this with additional models as needed

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }): Promise<Response> {
      try {
        // Format messages to match the expected structure
        const formattedMessages = messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        }));

        console.log('Starting API call with messages:', formattedMessages);

        // Use Anthropic's native streaming method
        const stream = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: formattedMessages,
          system: options?.system,
          stream: true,
        });

        // Convert the Anthropic stream to an AI stream compatible with Vercel AI SDK
        const aiStream = OpenAIStream(stream as any, {
          onError: (error) => {
            console.error('Streaming error:', error);
          }
        });

        // Return a streaming text response
        return new StreamingTextResponse(aiStream);
      } catch (error) {
        console.error('Claude API invocation error:', error);
        return new Response(JSON.stringify({ error: 'Failed to generate response' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },
  };
};
