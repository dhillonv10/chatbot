export interface Attachment {
  name: string;
  type: string;
  base64: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  experimental_attachments?: Attachment[];
}
