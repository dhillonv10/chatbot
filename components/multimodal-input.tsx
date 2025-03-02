'use client';

import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
} from 'ai';
import cx from 'classnames';
import { motion } from 'framer-motion';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { sanitizeUIMessages } from '@/lib/utils';

import { ArrowUpIcon, PaperclipIcon, StopIcon, FileIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

const suggestedActions = [
  {
    title: 'Upload a PDF',
    label: 'to analyze its contents',
    action: 'Please upload a PDF that you would like me to analyze.',
    icon: <FileIcon size={16} />
  },
  {
    title: 'What are the symptoms',
    label: 'of a heart attack?',
    action: 'What are the symptoms of a heart attack?',
  },
];

// Function to check if attachment is a PDF
function isPdfAttachment(attachment: Attachment) {
  return attachment.contentType === 'application/pdf' || 
         (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'));
}

export function MultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  const [hasPdf, setHasPdf] = useState(false);

  // Update PDF state when attachments change
  useEffect(() => {
    const pdfAttachments = attachments.filter(att => isPdfAttachment(att));
    setHasPdf(pdfAttachments.length > 0);
    
    // If we just uploaded a PDF, suggest an analysis prompt
    if (pdfAttachments.length > 0 && input === '') {
      const fileNames = pdfAttachments.map(pdf => pdf.name).join(', ');
      const suggestedPrompt = `Please analyze this PDF${pdfAttachments.length > 1 ? 's' : ''}: ${fileNames}`;
      setInput(suggestedPrompt);
    }
  }, [attachments, input, setInput]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    handleSubmit(undefined, {
      experimental_attachments: attachments,
    });

    setAttachments([]);
    setLocalStorageInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log(`Uploading file: ${file.name} (${file.type})`);
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const { error } = await response.json();
        toast.error(error || 'Failed to upload file');
        throw new Error(error || 'Failed to upload file');
      }

      const data = await response.json();
      const { url, contentType, name } = data;
      
      console.log(`File uploaded successfully: ${url} (${contentType})`);
      return { url, contentType, name };
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file, please try again!');
      return undefined;
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        
        const successfullyUploadedAttachments = uploadedAttachments
          .filter(Boolean);

        if (successfullyUploadedAttachments.length > 0) {
          setAttachments((currentAttachments) => [
            ...currentAttachments,
            ...successfullyUploadedAttachments,
          ]);
          
          // Check for PDF uploads and set auto-prompt
          const pdfs = successfullyUploadedAttachments.filter(att => 
            att.contentType === 'application/pdf' || 
            (att.name && att.name.toLowerCase().endsWith('.pdf'))
          );
          
          if (pdfs.length > 0 && input === '') {
            const fileNames = pdfs.map(pdf => pdf.name).join(', ');
            setInput(`Please analyze this PDF${pdfs.length > 1 ? 's' : ''}: ${fileNames}`);
          }
          
          toast.success(`Successfully uploaded ${successfullyUploadedAttachments.length} file(s)`);
        }
      } catch (error) {
        console.error('Error uploading files!', error);
        toast.error('There was a problem uploading your files.');
      } finally {
        setUploadQueue([]);
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [setAttachments, input, setInput],
  );

  return (
    <div className="relative w-full flex flex-col gap-4">
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <div className="grid sm:grid-cols-2 gap-2 w-full">
            {suggestedActions.map((suggestedAction, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.05 * index }}
                key={`suggested-action-${suggestedAction.title}-${index}`}
                className={index > 1 ? 'hidden sm:block' : 'block'}
              >
                <Button
                  variant="ghost"
                  onClick={async () => {
                    if (suggestedAction.title === "Upload a PDF") {
                      fileInputRef.current?.click();
                    } else {
                      window.history.replaceState({}, '', `/chat/${chatId}`);
                      append({
                        role: 'user',
                        content: suggestedAction.action,
                      });
                    }
                  }}
                  className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-2 sm:flex-col w-full h-auto justify-start items-start"
                >
                  <div className="flex items-center gap-2 font-medium">
                    {suggestedAction.icon && <span>{suggestedAction.icon}</span>}
                    <span>{suggestedAction.title}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {suggestedAction.label}
                  </span>
                </Button>
              </motion.div>
            ))}
          </div>
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
        accept=".pdf, image/png, image/jpeg"
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex flex-row gap-2 overflow-x-scroll items-end">
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.name} attachment={attachment} />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      {hasPdf && (
        <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5 ml-2 -mb-2">
          <FileIcon size={12} />
          <span>PDF uploaded and ready for analysis</span>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        placeholder={hasPdf ? "Ask me about the PDF content..." : "Send a message..."}
        value={input}
        onChange={handleInput}
        className={cx(
          'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl text-base bg-muted',
          {
            'border-blue-400 dark:border-blue-600': hasPdf
          },
          className,
        )}
        rows={3}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();

            if (isLoading) {
              toast.error('Please wait for the model to finish its response!');
            } else {
              submitForm();
            }
          }
        }}
      />

      {isLoading ? (
        <Button
          className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
          onClick={(event) => {
            event.preventDefault();
            stop();
            setMessages((messages) => sanitizeUIMessages(messages));
          }}
        >
          <StopIcon size={14} />
        </Button>
      ) : (
        <Button
          className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
          onClick={(event) => {
            event.preventDefault();
            submitForm();
          }}
          disabled={input.length === 0 || uploadQueue.length > 0}
        >
          <ArrowUpIcon size={14} />
        </Button>
      )}

      <Button
        className={cx(
          "rounded-full p-1.5 h-fit absolute bottom-2 right-11 m-0.5 dark:border-zinc-700",
          {"text-blue-600 dark:text-blue-400": hasPdf}
        )}
        onClick={(event) => {
          event.preventDefault();
          fileInputRef.current?.click();
        }}
        variant="outline"
        disabled={isLoading}
      >
        <PaperclipIcon size={14} />
      </Button>
    </div>
  );
}