"use client";

import { useState } from "react";
import type { Citation } from "@/lib/rag/citations";

interface Props {
  index: number;
  citation: Citation | undefined;
}

export function CitationChip({ index, citation }: Props) {
  const [open, setOpen] = useState(false);

  if (!citation) {
    return <sup className="text-xs text-gray-500">[{index}]</sup>;
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-0.5 rounded bg-blue-100 px-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
        title={`${citation.document_name} — chunk ${citation.chunk_index}`}
      >
        [{index}]
      </button>

      {open && (
        <span className="absolute z-10 mt-1 block w-72 rounded-md border border-gray-200 bg-white p-3 text-xs shadow-lg">
          <span className="block font-semibold text-gray-900">
            {citation.document_name}
          </span>
          <span className="block text-gray-500">
            Page {citation.page_number} · Chunk {citation.chunk_index}
            {typeof citation.rerank_score === "number"
              ? ` · Score ${citation.rerank_score}/10`
              : ""}
          </span>
          <span className="mt-2 block text-gray-700">
            {citation.excerpt}…
          </span>
        </span>
      )}
    </span>
  );
}