"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Reads the conversationId from the URL segment and redirects
// to /chat?conversationId=xxx so ChatPage can handle it via searchParams.
export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/chat?conversationId=${conversationId}`);
  }, [conversationId, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}