import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";

const metadataBase = process.env.NEXT_PUBLIC_APP_URL;
export const metadata: Metadata = {
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

if (metadataBase) {
  metadata.metadataBase = new URL(metadataBase);
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}