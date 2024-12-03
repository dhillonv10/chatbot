import Link from 'next/link';
import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  console.log('Rendering Markdown component:', {
    contentLength: children?.length,
    contentType: typeof children,
    firstChars: children?.substring(0, 50)
  });

  if (!children || typeof children !== 'string') {
    console.warn('Invalid markdown content:', { content: children, type: typeof children });
    return null;
  }

  const components: Partial<Components> = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <pre
          {...props}
          className={`${className} overflow-x-auto rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800`}
        >
          <code className={match[1]}>{children}</code>
        </pre>
      ) : (
        <code
          {...props}
          className={`${className} rounded-md bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800`}
        >
          {children}
        </code>
      );
    },
    p({ children }) {
      return <p className="mb-4 last:mb-0">{children}</p>;
    },
    a({ href, children }) {
      return (
        <Link
          href={href || ''}
          className="text-blue-500 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </Link>
      );
    }
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      className="prose dark:prose-invert"
    >
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(NonMemoizedMarkdown);
