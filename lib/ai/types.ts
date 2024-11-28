export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicResponse {
  id: string;
  content: Array<{
    text: string;
    type: 'text';
  }>;
  role: 'assistant';
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicError {
  type: string;
  message: string;
}