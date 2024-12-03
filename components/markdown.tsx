import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CodeProps {
  className?: string;
  children: React.ReactNode;
}

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

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: ({ className, children }: CodeProps) => {
          const language = className?.replace('language-', '');
          return (
            <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
              <code className={language ? `language-${language}` : ''}>
                {children}
              </code>
            </pre>
          );
        },
        p: ({ children }) => (
          <p className="mb-4 last:mb-0">{children}</p>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-blue-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        )
      }}
      className="prose dark:prose-invert"
    >
      {children}
    </ReactMarkdown>
  );
}
