"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeAiInput({ suggestedPrompts }: { suggestedPrompts: string[] }) {
  const [value, setValue] = useState("");
  const router = useRouter();

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    router.push(`/ai?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-colors focus-within:border-accent"
      >
        <Sparkles className="size-4 shrink-0 text-accent" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask anything about your campus..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="icon" className="size-8 shrink-0 rounded-full" disabled={!value.trim()}>
          <ArrowUp className="size-4" />
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {suggestedPrompts.map((p) => (
          <button
            key={p}
            onClick={() => submit(p)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/80 hover:border-accent hover:text-accent"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
