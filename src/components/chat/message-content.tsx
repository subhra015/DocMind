"use client";

import { Fragment } from "react";
import type { Citation } from "@/lib/rag/citations";
import { CitationChip } from "./citation-chip";

interface Props {
  content: string;
  citations?: Citation[];
}

/**
 * Renders assistant message text, converting [n] markers into
 * clickable CitationChip components.
 */
export function MessageContent({ content, citations = [] }: Props) {
  const parts = content.split(/(\[\d+\])/g);

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (m) {
          const idx = parseInt(m[1], 10);
          return (
            <CitationChip
              key={i}
              index={idx}
              citation={citations.find((c) => c.index === idx)}
            />
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}