// Utility functions for handling file attachments with Anthropic API

export interface Attachment {
  url: string;
  contentType?: string;
  name?: string;
}

export interface AnthropicContent {
  type: 'text' | 'image' | 'document';
  text?: string;
  source?: {
    type: 'url' | 'base64';
    url?: string;
    media_type?: string;
    data?: string;
  };
}

/**
 * Downloads a file from a URL and converts it to base64
 */
export async function downloadAndEncodeFile(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error downloading and encoding file:', error);
    throw new Error('Failed to process file for API');
  }
}

/**
 * Determines if an attachment is a PDF based on content type or filename
 */
export function isPDF(attachment: Attachment): boolean {
  const isPdfContentType = attachment.contentType === 'application/pdf';
  const isPdfFileName = attachment.name?.toLowerCase().endsWith('.pdf') ?? false;
  return isPdfContentType || isPdfFileName;
}

/**
 * Determines if an attachment is an image
 */
export function isImage(attachment: Attachment): boolean {
  if (!attachment.contentType) return false;
  return attachment.contentType.startsWith('image/');
}

/**
 * Converts an attachment to Anthropic API format
 * - Images: use URL format (type: "image")
 * - PDFs: download and convert to base64 (type: "document")
 */
export async function convertAttachmentToAnthropicFormat(
  attachment: Attachment
): Promise<AnthropicContent> {
  // Handle images - can use URL directly
  if (isImage(attachment)) {
    return {
      type: 'image',
      source: {
        type: 'url',
        url: attachment.url,
      },
    };
  }

  // Handle PDFs - must convert to base64
  if (isPDF(attachment)) {
    const base64Data = await downloadAndEncodeFile(attachment.url);
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64Data,
      },
    };
  }

  // Fallback for unknown types - try as image URL
  console.warn(`Unknown attachment type: ${attachment.contentType}, treating as image`);
  return {
    type: 'image',
    source: {
      type: 'url',
      url: attachment.url,
    },
  };
}

/**
 * Converts multiple attachments to Anthropic API format
 */
export async function convertAttachmentsToAnthropicFormat(
  attachments: Attachment[]
): Promise<AnthropicContent[]> {
  const conversionPromises = attachments.map(att =>
    convertAttachmentToAnthropicFormat(att)
  );
  return Promise.all(conversionPromises);
}
