"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Send, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ConversationRow, MessageRow, CitationSource } from "@/types";
import type { DocumentRow } from "@/types";

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document");
  const conversationIdParam = searchParams.get("conversationId");

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentConvId, setCurrentConvId] = useState<string | null>(
    conversationIdParam
  );
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(documentId);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    setConversations((data as ConversationRow[]) ?? []);
  }, []);

  const loadDocuments = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("documents")
      .select("*")
      .eq("status", "ready")
      .order("created_at", { ascending: false });
    setDocuments((data as DocumentRow[]) ?? []);
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabaseBrowser()
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((data as MessageRow[]) ?? []);
  }, []);

  useEffect(() => {
    loadConversations();
    loadDocuments();
  }, [loadConversations, loadDocuments]);

  useEffect(() => {
    if (conversationIdParam) {
      setCurrentConvId(conversationIdParam);
      loadMessages(conversationIdParam);
    }
  }, [conversationIdParam, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function createConversation() {
    const { data } = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Chat",
        documentId: selectedDoc,
      }),
    }).then((r) => r.json());

    if (data?.id) {
      setCurrentConvId(data.id);
      setMessages([]);
      await loadConversations();
    }
  }

  async function sendMessage() {
    if (!input.trim() || !currentConvId || isGenerating) return;

    const userMsg: MessageRow = {
      id: `temp-${Date.now()}`,
      conversation_id: currentConvId,
      user_id: "",
      role: "user",
      content: input.trim(),
      sources: [],
      token_usage: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const question = input.trim();
    setInput("");
    setIsGenerating(true);
    setStreamingText("");

    try {
      abortRef.current = new AbortController();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConvId,
          message: question,
          documentId: selectedDoc,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullText = "";
      let citationData: CitationSource[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              fullText += event.data;
              setStreamingText(fullText);
            } else if (event.type === "citations") {
              citationData = event.data;
            } else if (event.type === "done") {
              const assistantMsg: MessageRow = {
                id: event.data.messageId,
                conversation_id: currentConvId,
                user_id: "",
                role: "assistant",
                content: fullText,
                sources: citationData,
                token_usage: null,
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingText("");
            }
          } catch {
            // incomplete JSON line
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStreamingText("");
      }
    } finally {
      setIsGenerating(false);
      setStreamingText("");
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    setIsGenerating(false);
    setStreamingText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4">
      {/* Left panel - conversations + document selector */}
      <div className="hidden w-64 shrink-0 border-r pr-4 lg:block">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Conversations
          </h2>
          <Button variant="ghost" size="iconSm" onClick={createConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setCurrentConvId(conv.id);
                loadMessages(conv.id);
                router.push(`/chat?conversationId=${conv.id}`);
              }}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                currentConvId === conv.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <p className="truncate">{conv.title}</p>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              No conversations yet
            </p>
          )}
        </div>

        <div className="mt-4 border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Search scope
          </p>
          <button
            onClick={() => setSelectedDoc(null)}
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors mb-1 ${
              selectedDoc === null
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            📚 Entire library
          </button>
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoc(doc.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors truncate ${
                selectedDoc === doc.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              📄 {doc.original_filename}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel - conversation */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && !streamingText && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Ask a question</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Select a document scope on the left, then ask anything
                about your documents.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg bg-muted px-4 py-3 text-sm">
                <p className="whitespace-pre-wrap">{streamingText}</p>
                <span className="inline-block h-4 w-1.5 animate-pulse bg-primary ml-1 rounded-full" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="border-t pt-4">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents…"
              className="min-h-[44px] resize-none"
              rows={1}
              disabled={isGenerating}
            />
            {isGenerating ? (
              <Button
                variant="outline"
                size="icon"
                onClick={stopGeneration}
              >
                <div className="h-4 w-4 rounded-sm bg-foreground" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || !currentConvId}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedDoc
              ? `Searching in selected document`
              : "Searching entire library"}{" "}
            · Press Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageRow }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser &&
          Array.isArray(message.sources) &&
          message.sources.length > 0 && (
            <div className="mt-2 border-t border-border/50 pt-2">
              <p className="text-xs text-muted-foreground font-medium mb-1">
                Sources
              </p>
              <div className="flex flex-wrap gap-1">
                {(message.sources as CitationSource[]).map((src, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs"
                  >
                    {src.filename} p.{src.pageNumber}
                  </Badge>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}