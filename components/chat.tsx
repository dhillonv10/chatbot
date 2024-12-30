'use client';

import { useChat } from 'ai/react';
import { useEffect } from 'react';
import { MultimodalInput } from './multimodal-input';

export function Chat({ chatId, initialMessages }: { chatId: string; initialMessages: Array<Message> }) {
  const {
    messages,
    input,
    setInput,
    append,
    isLoading,
    stop,
    handleSubmit,
    setMessages,
  } = useChat({
    initialMessages,
    id: chatId,
  });

  useEffect(() => {
    if (input && messages.some((msg) => msg.role === 'assistant')) {
      handleSubmit();
    }
  }, [input, messages, handleSubmit]);

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <MultimodalInput
        chatId={chatId}
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        stop={stop}
        attachments={[]}
        setAttachments={() => {}}
        messages={messages}
        setMessages={setMessages}
        append={append}
        handleSubmit={handleSubmit}
      />
    </div>
  );
}
