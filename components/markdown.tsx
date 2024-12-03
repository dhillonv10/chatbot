import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children }: { children: string }) {
  console.log('Rendering Markdown component:', {
    contentLength: children?.length,
    contentType: typeof children,
    firstChars: children?.substring(0, 50)
  });

  if (!children || typeof children !== 'string') {
    console.warn('Invalid markdown content:', { content: children, type: typeof children });
    return null;
  }

  const components: Components = {
    code({ inline, className, children }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
          <code className={className}>
            {String(children).replace(/\n$/, '')}
          </code>
        </pre>
      ) : (
        <code className={className}>
          {children}
        </code>
      );
    },
    p({ children }) {
      return <p className="mb-4 last:mb-0">{children}</p>;
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          className="text-blue-500 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
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
}
