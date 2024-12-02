import { type Message } from 'ai';
import { Anthropic } from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '' // Handle empty string case for Vercel env
});

export const customModel = (apiIdentifier: string) => {
  return {
    id: apiIdentifier,
    provider: 'anthropic' as const,
    async invoke({ messages, options }: { messages: Message[]; options?: { system?: string } }) {
      // Format messages with explicit type literals
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      console.log('Starting API call with messages:', messages);
      const response = await anthropic.messages.create({
        model: apiIdentifier,
        messages: formattedMessages,
        system: options?.system,
        max_tokens: 4096,
        stream: true
      });

      console.log('Got response from Anthropic, processing response');
      
      // Collect the full response
      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          fullResponse += chunk.delta.text;
        }
      }

      // Clean up any command artifacts
      fullResponse = fullResponse
        .replace(/createDocument[^{]*/, '')
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\{[^}]*\}/g, '')
        .trim();

      // Return the response as a simple JSON string
      return new Response(JSON.stringify({
        role: 'assistant',
        content: fullResponse,
        id: Date.now().toString()
      }));
    }
  };
};
