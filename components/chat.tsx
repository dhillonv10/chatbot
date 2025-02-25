// File: /components/chat.tsx (key updates)
'use client';

import type { Attachment, Message } from 'ai';
import { useChat } from 'ai/react';
import { AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useWindowSize } from 'usehooks-ts';

import { ChatHeader } from '@/components/chat-header';
import { PreviewMessage, ThinkingMessage, ProcessingPdfMessage } from '@/components/message';
import { useScrollToBottom } from '@/components/use-scroll-to-bottom';
import type { Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';

import { Block, type UIBlock } from './block';
import { BlockStreamHandler } from './block-stream-handler';
import { MultimodalInput } from './multimodal-input';
import { Overview } from './overview';

// Helper function to check if there are PDF attachments
function hasPdfAttachments(attachments: Attachment[]) {
  return attachments.some(attachment => 
    attachment.contentType === 'application/pdf' || 
    (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'))
  );
}

export function Chat({
    id,
    initialMessages,
    selectedModelId,
}: {
    id: string;
    initialMessages: Array<Message>;
    selectedModelId: string;
}) {
    const { mutate } = useSWRConfig();

    const {
        messages,
        setMessages,
        handleSubmit,
        input,
        setInput,
        append,
        isLoading,
        stop,
        data: streamingData,
    } = useChat({
        api: '/api/chat',
        body: { id, modelId: selectedModelId },
        initialMessages,
        onResponse: async (response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Process response stream
            const reader = response.body?.getReader();
            if (!reader) {
                console.error('No reader available');
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');

                    for (let i = 0; i < lines.length - 1; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;

                        if (line === 'data: [DONE]') {
                            await reader.cancel();
                            return;
                        }

                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                setMessages((prev) => {
                                    const lastMsg = prev[prev.length - 1];
                                    if (lastMsg?.id === data.id) {
                                        // Add attachment info to assistant messages
                                        const assistantMessage = {
                                            ...lastMsg,
                                            content: data.content,
                                            // Track if previous message had attachments
                                            previousMessageHasAttachments: prev.length > 1 && 
                                              prev[prev.length - 2].experimental_attachments?.length > 0,
                                            previousMessageAttachments: prev.length > 1 ? 
                                              prev[prev.length - 2].experimental_attachments : undefined
                                        };
                                        return [...prev.slice(0, -1), assistantMessage];
                                    } else {
                                        // Same attachment tracking for new messages
                                        const assistantMessage = {
                                            ...data,
                                            previousMessageHasAttachments: prev.length > 0 && 
                                              prev[prev.length - 1].experimental_attachments?.length > 0,
                                            previousMessageAttachments: prev.length > 0 ? 
                                              prev[prev.length - 1].experimental_attachments : undefined
                                        };
                                        return [...prev, assistantMessage];
                                    }
                                });
                            } catch (error) {
                                console.error('Error parsing data:', error);
                            }
                        }
                    }

                    buffer = lines[lines.length - 1];
                }
            } catch (error) {
                console.error('Error reading stream:', error);
            } finally {
                reader.releaseLock();
            }
        },
        onFinish: (message) => {
            console.log('Chat finished:', message);
            mutate('/api/history');
        },
        onError: (error) => {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content:
                        'I apologize, but I encountered an error processing your request. Please try again.',
                    createdAt: new Date(),
                },
            ]);
        },
    });

    const [hasActivePdfSubmission, setHasActivePdfSubmission] = useState(false);

    // Effect to track PDF submissions
    useEffect(() => {
        if (messages.length > 0) {
            const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
            
            if (lastUserMessage?.experimental_attachments && 
                hasPdfAttachments(lastUserMessage.experimental_attachments) && 
                isLoading) {
                setHasActivePdfSubmission(true);
            } else if (!isLoading) {
                setHasActivePdfSubmission(false);
            }
        }
    }, [messages, isLoading]);

    const { width: windowWidth = 1920, height: windowHeight = 1080 } =
        useWindowSize();

    const [block, setBlock] = useState<UIBlock>({
        documentId: 'init',
        content: '',
        title: '',
        status: 'idle',
        isVisible: false,
        boundingBox: {
            top: windowHeight / 4,
            left: windowWidth / 4,
            width: 250,
            height: 50,
        },
    });

    const { data: votes } = useSWR<Array<Vote>>(
        `/api/vote?chatId=${id}`,
        fetcher,
    );

    const [messagesContainerRef, messagesEndRef] =
        useScrollToBottom<HTMLDivElement>();

    const [attachments, setAttachments] = useState<Array<Attachment>>([]);

    // Create a custom submit handler that can handle PDF specific UX
    const handleSubmitWithPdfSupport = (event?: {preventDefault?: () => void}, options?: any) => {
        // Check if this submission contains PDFs
        const hasPdfs = hasPdfAttachments(attachments);
        
        // If there's no input text but there are PDF attachments, add a default message
        if (input.trim() === '' && hasPdfs) {
            const pdfNames = attachments
                .filter(a => a.contentType === 'application/pdf' || 
                           (a.name && a.name.toLowerCase().endsWith('.pdf')))
                .map(a => a.name)
                .join(', ');
                
            setInput(`Please analyze this PDF${attachments.length > 1 ? 's' : ''}: ${pdfNames}`);
        }
        
        // Now call the original submit handler
        handleSubmit(event, options);
    };

    return (
        <>
            <div className="flex flex-col min-w-0 h-dvh bg-background">
                <ChatHeader selectedModelId={selectedModelId} />
                <div
                    ref={messagesContainerRef}
                    className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
                >
                    {messages.length === 0 && <Overview />}

                    {messages.map((message, index) => (
                        <PreviewMessage
                            key={message.id}
                            chatId={id}
                            message={message}
                            block={block}
                            setBlock={setBlock}
                            isLoading={isLoading && messages.length - 1 === index}
                            vote={
                                votes
                                    ? votes.find((vote) => vote.messageId === message.id)
                                    : undefined
                            }
                        />
                    ))}

                    {isLoading && (
                        hasActivePdfSubmission ? (
                            // Special loading state for PDF processing
                            <ProcessingPdfMessage />
                        ) : (
                            messages.length > 0 &&
                            messages[messages.length - 1].role === 'user' && (
                                <ThinkingMessage />
                            )
                        )
                    )}

                    <div
                        ref={messagesEndRef}
                        className="shrink-0 min-w-[24px] min-h-[24px]"
                    />
                </div>
                <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
                    <MultimodalInput
                        chatId={id}
                        input={input}
                        setInput={setInput}
                        handleSubmit={handleSubmitWithPdfSupport}
                        isLoading={isLoading}
                        stop={stop}
                        attachments={attachments}
                        setAttachments={setAttachments}
                        messages={messages}
                        setMessages={setMessages}
                        append={append}
                    />
                </form>
            </div>

            <AnimatePresence>
                {block?.isVisible && (
                    <Block
                        chatId={id}
                        input={input}
                        setInput={setInput}
                        handleSubmit={handleSubmit}
                        isLoading={isLoading}
                        stop={stop}
                        attachments={attachments}
                        setAttachments={setAttachments}
                        append={append}
                        block={block}
                        setBlock={setBlock}
                        messages={messages}
                        setMessages={setMessages}
                        votes={votes}
                    />
                )}
            </AnimatePresence>

            <BlockStreamHandler streamingData={streamingData} setBlock={setBlock} />
        </>
    );
}