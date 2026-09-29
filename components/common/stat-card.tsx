import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_ICON_CLASSES: Record<string, string> = {
  default: "bg-secondary text-foreground/70",
  warning: "bg-warning/12 text-warning",
  success: "bg-success/12 text-success",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "warning" | "success" | "destructive";
}) {
  return (
    <div className="card-surface-interactive p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", TONE_ICON_CLASSES[tone])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 text-[1.7rem] font-semibold leading-none tracking-tight">{value}</p>
      {detail && <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
