import type { Message } from 'ai';
import type { AnthropicMessage } from './types';

export function convertToAnthropicMessages(messages: Message[]): AnthropicMessage[] {
  return messages.map(message => ({
    role: message.role === 'user' ? 'user' : 'assistant',
    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
  }));
}

export function sanitizeAnthropicResponse(content: string): string {
  // Remove any system-level or internal markers that Claude might add
  return content.replace(/^Claude:?\s*/i, '').trim();
}