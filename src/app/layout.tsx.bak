import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";

const FALLBACK_URL = "https://docmind02.vercel.app";

function resolveMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return new URL(FALLBACK_URL);
  try {
    return new URL(raw);
  } catch {
    console.warn(
      `[layout] NEXT_PUBLIC_APP_URL is not a valid URL: "${raw}". Falling back to ${FALLBACK_URL}.`
    );
    return new URL(FALLBACK_URL);
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "DocMind — AI-Powered Document Intelligence",
    template: "%s | DocMind",
  },
  description:
    "Upload your PDFs, search them semantically, and get citation-aware AI answers.",
  keywords: [
    "PDF",
    "RAG",
    "AI",
    "semantic search",
    "document intelligence",
    "vector search",
  ],
};