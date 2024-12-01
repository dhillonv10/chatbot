import type { JSONValue } from 'ai';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';

import type { Suggestion } from '@/lib/db/schema';

import type { UIBlock } from './block';

type StreamingDelta = {
  type: 'text-delta' | 'title' | 'id' | 'suggestion' | 'clear' | 'finish';
  content: string | Suggestion;
};

export function useBlockStream({
  streamingData,
  setBlock,
}: {
  streamingData: JSONValue[] | undefined;
  setBlock: Dispatch<SetStateAction<UIBlock>>;
}) {
  const { mutate } = useSWRConfig();
  const [optimisticSuggestions, setOptimisticSuggestions] = useState<
    Array<Suggestion>
  >([]);

  useEffect(() => {
    if (optimisticSuggestions && optimisticSuggestions.length > 0) {
      const [optimisticSuggestion] = optimisticSuggestions;
      const url = `/api/suggestions?documentId=${optimisticSuggestion.documentId}`;
      mutate(url, optimisticSuggestions, false);
    }
  }, [optimisticSuggestions, mutate]);

  useEffect(() => {
    console.log('Block stream received new data:', streamingData);
    const mostRecentDelta = streamingData?.at(-1);
    if (!mostRecentDelta) {
      console.log('No recent delta found');
      return;
    }

    console.log('Processing delta:', mostRecentDelta);
    // Handle our SSE format
    const message = mostRecentDelta as { role: string; content: string };
    if (message.role === 'assistant') {
      console.log('Updating block with assistant message:', message.content);
      setBlock((draftBlock) => ({
        ...draftBlock,
        content: message.content,
        status: 'streaming' as const,
        isVisible: true
      }));
    } else {
      console.log('Skipping non-assistant message:', message);
    }
  }, [streamingData, setBlock]);
}
