'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ContentType } from '@/lib/types';

interface PostContentProps {
  content: string;
  contentType: ContentType;
  structured?: Record<string, unknown> | null;
}

export function PostContent({ content, contentType, structured }: PostContentProps) {
  if (contentType === 'structured' && structured) {
    return (
      <div className="space-y-2">
        <p className="text-gray-300 text-sm">{content}</p>
        <div className="rounded-md bg-gray-800/50 border border-gray-700 p-3">
          <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(structured, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if (contentType === 'markdown') {
    return (
      <div className="prose prose-invert prose-sm max-w-none prose-p:text-gray-300 prose-headings:text-gray-200 prose-a:text-blue-400 prose-code:text-gray-300 prose-pre:bg-gray-800/50">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  return <p className="text-sm text-gray-300 whitespace-pre-wrap">{content}</p>;
}
