import type { Message } from 'ai';
import cx from 'classnames';
import { motion } from 'framer-motion';
import type { Dispatch, SetStateAction } from 'react';

import type { Vote } from '@/lib/db/schema';

import type { UIBlock } from './block';
import { DocumentToolCall, DocumentToolResult } from './document';
import { SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';

export const PreviewMessage = ({
  chatId,
  message,
  block,
  setBlock,
  vote,
  isLoading,
}: {
  chatId: string;
  message: Message;
  block: UIBlock;
  setBlock: Dispatch<SetStateAction<UIBlock>>;
  vote: Vote | undefined;
  isLoading: boolean;
}) => {
  console.log('Rendering PreviewMessage:', {
    id: message.id,
    role: message.role,
    content: message.content,
    contentType: typeof message.content,
    contentLength: message.content?.length,
    isLoading,
    hasTools: !!message.toolInvocations?.length,
    messageKeys: Object.keys(message)
  });

  const { role, content } = message;
  const isUser = role === 'user';

  if (!content || typeof content !== 'string') {
    console.warn('Invalid message content:', { content, type: typeof content });
    return null;
  }

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cx(
          'group-data-[role=user]/message:bg-primary group-data-[role=user]/message:text-primary-foreground flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
        )}
      >
        {message.role === 'assistant' && (
          <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4">
            <div className="debug-info" style={{display: 'none'}}>
              Content before Markdown: {JSON.stringify(message.content)}
            </div>
            <Markdown>{message.content as string}</Markdown>
          </div>

          {message.toolInvocations && message.toolInvocations.length > 0 && (
            <div className="flex flex-col gap-4">
              {message.toolInvocations.map((toolInvocation) => {
                const { toolName, toolCallId, state, args } = toolInvocation;

                if (state === 'result') {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : toolName === 'createDocument' ? (
                        <DocumentToolResult
                          type="create"
                          result={result}
                          block={block}
                          setBlock={setBlock}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult
                          type="update"
                          result={result}
                          block={block}
                          setBlock={setBlock}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type="request-suggestions"
                          result={result}
                          block={block}
                          setBlock={setBlock}
                        />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
                return (
                  <div
                    key={toolCallId}
                    className={cx({
                      skeleton: ['getWeather'].includes(toolName),
                    })}
                  >
                    {toolName === 'getWeather' ? (
                      <Weather />
                    ) : toolName === 'createDocument' ? (
                      <DocumentToolCall
                        type="create"
                        args={args}
                        setBlock={setBlock}
                      />
                    ) : toolName === 'updateDocument' ? (
                      <DocumentToolCall
                        type="update"
                        args={args}
                        setBlock={setBlock}
                      />
                    ) : toolName === 'requestSuggestions' ? (
                      <DocumentToolCall
                        type="request-suggestions"
                        args={args}
                        setBlock={setBlock}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {message.experimental_attachments && (
            <div className="flex flex-row gap-2">
              {message.experimental_attachments.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={attachment}
                />
              ))}
            </div>
          )}

          <MessageActions
            key={`action-${message.id}`}
            chatId={chatId}
            message={message}
            vote={vote}
            isLoading={isLoading}
          />
        </div>
      </div>
    </motion.div>
  );
};

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};

import { type Message } from 'ai';
import { cn } from '@/lib/utils';
import { IconOpenAI, IconUser } from '@/components/ui/icons';
import { Markdown } from './markdown';

export interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

export function Message({ message, isLoading }: ChatMessageProps) {
  const { role, content } = message;
  const isUser = role === 'user';

  console.log('Message component rendering:', {
    role,
    contentType: typeof content,
    contentLength: content?.length,
    isLoading
  });

  if (!content || typeof content !== 'string') {
    console.warn('Invalid message content:', { content, type: typeof content });
    return null;
  }

  return (
    <div className={cn('group relative mb-4 flex items-start md:-ml-12')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow',
          isUser ? 'bg-background' : 'bg-primary text-primary-foreground'
        )}
      >
        {isUser ? <IconUser /> : <IconOpenAI />}
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <div className="prose break-words dark:prose-invert">
          <Markdown>{content}</Markdown>
        </div>
        {message.toolInvocations?.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {message.toolInvocations.map((tool) => (
              <div
                key={tool.toolCallId}
                className="rounded-lg border bg-muted/50 p-4 text-sm"
              >
                <div className="font-medium">Tool: {tool.toolName}</div>
                <div className="mt-1 font-mono text-xs">
                  {JSON.stringify(tool.args, null, 2)}
                </div>
                {tool.state === 'result' && (
                  <div className="mt-2">
                    <div className="font-medium text-muted-foreground">Result:</div>
                    <div className="mt-1 font-mono text-xs">
                      {JSON.stringify(tool.result, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
