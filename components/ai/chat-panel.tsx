"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ArrowUp, Wrench } from "lucide-react";
import { apiPost } from "@/lib/client/api";
import { useNetworkMode } from "@/lib/client/network";
import type { AssistantMessage, ChatMessage } from "@/lib/ai/types";
import { AiCardView } from "./ai-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChatPanel({ suggestedPrompts, poweredBy }: { suggestedPrompts: string[]; poweredBy?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode] = useNetworkMode();
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const autoSentRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setSending(true);
    try {
      const reply = await apiPost<AssistantMessage>("/api/ai/chat", { message: trimmed, history: nextHistory });
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "assistant", text: err instanceof Error ? err.message : "Something went wrong.", toolTrace: [], cards: [], actions: [] },
      ]);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSentRef.current) {
      autoSentRef.current = true;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleAction(action: NonNullable<AssistantMessage["actions"]>[number]) {
    if (action.kind === "link" && action.href) {
      router.push(action.href);
      return;
    }
    if (action.kind === "confirm" && action.payload) {
      setSending(true);
      try {
        const reply = await apiPost<AssistantMessage>("/api/ai/act", { payload: action.payload });
        setMessages((prev) => [...prev, reply]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: "assistant", text: err instanceof Error ? err.message : "Something went wrong.", toolTrace: [], cards: [], actions: [] },
        ]);
      } finally {
        setSending(false);
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-6 pb-4 sm:px-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Ask anything about your campus</p>
                <p className="text-xs text-muted-foreground">The AI can look things up and take action on your behalf.</p>
                {poweredBy && (
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    {poweredBy === "Groq" ? "Powered by Groq" : "Running in offline demo mode - add GROQ_API_KEY for a live model"}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground/80 hover:border-accent hover:text-accent"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onAction={handleAction} />
          ))}

          {sending && <ThinkingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border/70 bg-background/95 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3 sm:px-6"
        >
          <div className="flex flex-1 items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-sm transition-colors focus-within:border-accent">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={mode === "offline" ? "AI needs a connection - reconnect to ask a question" : "Ask anything about your campus..."}
              disabled={mode === "offline"}
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <Button type="submit" size="icon" disabled={sending || mode === "offline" || !input.trim()} className="rounded-full">
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-2.5 duration-300 animate-in fade-in slide-in-from-bottom-1">
      <div className="relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <span className="absolute inset-0 rounded-full bg-primary/50 animate-ping" />
        <Sparkles className="relative size-3" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-secondary px-4 py-3">
        <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
        <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
        <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onAction,
}: {
  message: ChatMessage;
  onAction: (action: NonNullable<AssistantMessage["actions"]>[number]) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end duration-300 animate-in fade-in slide-in-from-bottom-1">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{message.text}</div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 duration-300 animate-in fade-in slide-in-from-bottom-1">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="size-3" />
      </div>
      <div className="max-w-[85%] flex-1 space-y-2.5">
        {message.toolTrace.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Wrench className="size-3" />
            {message.toolTrace.map((t, i) => (
              <span key={i} className="rounded-full bg-muted px-2 py-0.5 font-mono">
                {t.tool}
              </span>
            ))}
          </div>
        )}
        <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-2.5 text-sm leading-relaxed">{message.text}</div>
        {message.cards.map((card, i) => (
          <AiCardView key={i} card={card} />
        ))}
        {message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.style === "primary" ? "default" : "outline"}
                className={cn(action.style === "destructive" && "border-destructive text-destructive")}
                onClick={() => onAction(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
