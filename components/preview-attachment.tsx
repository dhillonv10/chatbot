// File: /components/preview-attachment.tsx
import type { Attachment } from 'ai';

import { LoaderIcon, FileIcon } from './icons';

interface PreviewAttachmentProps {
  attachment: Attachment;
  isUploading?: boolean;
}

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
}: PreviewAttachmentProps) => {
  const { name, url, contentType } = attachment;
  
  // Function to get file extension from name or contentType
  const getFileExtension = (): string => {
    if (name && name.includes('.')) {
      return name.split('.').pop()?.toLowerCase() || '';
    }
    if (contentType) {
      const parts = contentType.split('/');
      return parts[parts.length - 1].toLowerCase();
    }
    return '';
  };
  
  const fileExt = getFileExtension();
  const isPdf = fileExt === 'pdf' || contentType === 'application/pdf';

  return (
    <div className="flex flex-col gap-2">
      <div className="w-20 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center">
        {contentType ? (
          contentType.startsWith('image') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={name ?? 'An image attachment'}
              className="rounded-md size-full object-cover"
            />
          ) : isPdf ? (
            <div className="flex flex-col items-center justify-center w-full h-full bg-red-50 dark:bg-red-900/20 rounded-md">
              <FileIcon size={24} />
              <span className="text-xs mt-1 text-red-600 dark:text-red-400">PDF</span>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <FileIcon size={24} />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center">
            <FileIcon size={24} />
          </div>
        )}

        {isUploading && (
          <div className="animate-spin absolute text-zinc-500">
            <LoaderIcon />
          </div>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">{name}</div>
    </div>
  );
};