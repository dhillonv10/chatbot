export interface FileUploadResponse {
  type: 'stream';
  content: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  content: string;
}
