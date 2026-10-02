import Link from "next/link";
import {
  FileText,
  Search,
  MessagesSquare,
  BookOpenCheck,
  ShieldCheck,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: FileText,
    title: "PDF intelligence",
    description:
      "Upload your library and DocMind parses every page in the background, preserving page boundaries and structure.",
  },
  {
    icon: Search,
    title: "Semantic search",
    description:
      "Query your documents with natural language. pgvector-powered retrieval finds relevant passages across your entire library.",
  },
  {
    icon: MessagesSquare,
    title: "Citation-aware chat",
    description:
      "Ask questions and receive streamed answers grounded in your documents — every claim links to its exact source page.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    description:
      "Row-level security isolates every tenant. Your files live in a private, signed-URL-only storage bucket.",
  },
  {
    icon: Zap,
    title: "Asynchronous processing",
    description:
      "Ingestion runs as durable background jobs with retries — upload and get answers while documents process in the background.",
  },
  {
    icon: BookOpenCheck,
    title: "Clickable citations",
    description:
      "Open any source at the exact cited page. No more hunting through 200-page PDFs for the evidence behind an answer.",
  },
];

const steps = [
  {
    step: "01",
    title: "Upload PDFs",
    description:
      "Drag in one file or your whole library. Files are stored privately and processed page-by-page.",
  },
  {
    step: "02",
    title: "Docs get indexed",
    description:
      "A background worker extracts text, splits content into page-aware chunks, and embeds them for search.",
  },
  {
    step: "03",
    title: "Ask anything",
    description:
      "Chat with one document or your whole library. Every answer streams in real time with clickable sources.",
  },
];

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              DocMind
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern" />
        <div className="container relative flex flex-col items-center py-24 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Multi-tenant · Private · Citation-grounded
          </span>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Your documents,
            <br />
            <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
              finally searchable.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            DocMind turns your PDF library into an intelligent workspace. Upload
            documents, ask natural-language questions, and get streamed answers
            backed by clickable page-level citations.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Create free account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required · Email verification only
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/20 py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              A full document intelligence platform
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to work with your PDFs at scale — not just a
              chatbot bolted onto a search box.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground">
              Three steps from upload to grounded answers.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.step} className="relative">
                <div className="mb-4 text-5xl font-bold text-primary/20">
                  {s.step}
                </div>
                <h3 className="mb-2 font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="border-t bg-muted/20 py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight">
            Security is the foundation
          </h2>
          <p className="mt-4 text-muted-foreground">
            DocMind enforces tenant isolation at the database level with
            Postgres Row-Level Security. Your documents are stored in a private
            storage bucket accessible only through short-lived signed URLs.
            Every write is scoped to your authenticated identity.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to make your documents intelligent?
          </h2>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Create free account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">DocMind</span>
          </div>
          <p className="text-xs text-muted-foreground">
            A production-oriented full-stack RAG platform.
          </p>
        </div>
      </footer>
    </div>
  );
}