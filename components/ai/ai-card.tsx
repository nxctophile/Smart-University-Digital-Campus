import { Check, X, ShieldCheck } from "lucide-react";
import type { AICard } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

export function AiCardView({ card }: { card: AICard }) {
  switch (card.type) {
    case "checklist":
      return (
        <div className="card-surface p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{card.title}</p>
          <ul className="space-y-1.5">
            {card.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {item.passed ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                )}
                <span>
                  {item.label}
                  {item.detail && <span className="text-muted-foreground"> — {item.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "table":
      return (
        <div className="overflow-hidden card-surface">
          <p className="border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">{card.title}</p>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  {card.columns.map((col) => (
                    <th key={col.key} className="whitespace-nowrap px-3 py-2 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.rows.map((row, i) => (
                  <tr key={i} className="border-t border-border transition-colors hover:bg-muted/30">
                    {card.columns.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-3 py-1.5">
                        {String(row[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "stat":
      return (
        <div
          className={cn(
            "rounded-lg border p-3",
            card.tone === "warning" ? "border-warning/40 bg-warning/10" : card.tone === "success" ? "border-success/40 bg-success/10" : "border-border bg-card",
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">{card.value}</p>
          {card.detail && <p className="mt-0.5 text-xs text-muted-foreground">{card.detail}</p>}
        </div>
      );

    case "certificate":
      return (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent" />
            <p className="text-sm font-medium">{card.title}</p>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Verification code</dt>
            <dd className="font-mono">{card.verificationCode}</dd>
            <dt className="text-muted-foreground">Issued</dt>
            <dd>{card.issuedAt}</dd>
            {card.purpose && (
              <>
                <dt className="text-muted-foreground">Purpose</dt>
                <dd>{card.purpose}</dd>
              </>
            )}
          </dl>
        </div>
      );

    case "risk":
      return (
        <div className="card-surface p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{card.title}</p>
          <ul className="space-y-1.5">
            {card.factors.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    "mt-1 size-1.5 shrink-0 rounded-full",
                    f.severity === "high" ? "bg-destructive" : f.severity === "medium" ? "bg-warning" : "bg-muted-foreground",
                  )}
                />
                <span>
                  <span className="font-medium">{f.label}:</span> {f.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );

    default:
      return null;
  }
}
