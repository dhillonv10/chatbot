// types/extended-message.ts 
import type { Attachment, Message } from 'ai';

// Create an extended version of the Message type with our custom properties
export interface ExtendedMessage extends Message {
  previousMessageHasAttachments?: boolean;
  previousMessageAttachments?: Attachment[];
}

// Helper function to safely check for PDF attachments
export function isPdfAttachment(attachment: Attachment): boolean {
  return attachment.contentType === 'application/pdf' || 
         (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'));
}

// Helper function to check if a message contains PDF attachments
export function containsPdfAttachments(message: Message | ExtendedMessage): boolean {
  if (!message.experimental_attachments?.length) return false;
  
  return message.experimental_attachments.some(att => isPdfAttachment(att));
}

// Helper function to check if attachments array contains PDFs
export function hasPdfAttachments(attachments: Attachment[]): boolean {
  return attachments.some(attachment => isPdfAttachment(attachment));
}

// Helper function to safely check if previous message had PDF attachments
export function isPreviousMessagePdf(message: ExtendedMessage): boolean {
  if (message.role !== 'assistant') return false;
  if (!message.previousMessageHasAttachments) return false;
  if (!message.previousMessageAttachments?.length) return false;
  
  return message.previousMessageAttachments.some(att => isPdfAttachment(att));
}