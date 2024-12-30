'use client';

import React, { useRef, useState, useCallback, ChangeEvent } from 'react';
import { sendPdfToClaude } from '@/lib/ai/models';
import { useLocalStorage } from 'usehooks-ts';
import { Button, Textarea } from './ui';
import { sanitizeUIMessages } from '@/lib/utils';

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
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<File>;
  setAttachments: React.Dispatch<React.SetStateAction<Array<File>>>;
  messages: Array<Message>;
  setMessages: React.Dispatch<React.SetStateAction<Array<Message>>>;
  append: (message: Message) => Promise<string | null | undefined>;
  handleSubmit: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      setUploadQueue(files.map((file) => file.name));

      try {
        const firstFile = files[0];
        const response = await sendPdfToClaude(
          firstFile,
          input || 'Please analyze the attached file.'
        );

        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: response.choices[0].message.content,
            createdAt: new Date(),
          },
        ]);
      } catch (error) {
        console.error('Error handling file upload:', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [input, setMessages]
  );

  const submitForm = useCallback(() => {
    handleSubmit();
    setAttachments([]);
    setLocalStorageInput('');
  }, [handleSubmit, setAttachments, setLocalStorageInput]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Send a message..."
        rows={2}
      />

      <div className="flex gap-2">
        <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
          Upload PDF
        </Button>
        <Button
          onClick={submitForm}
          disabled={input.trim().length === 0 || isLoading || uploadQueue.length > 0}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
