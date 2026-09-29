import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  disbursed: "Disbursed",
};

/** Horizontal status stepper, inspired by the step-tracker pattern used on
 * DTE MP Online's admissions counselling portal (registration → choice
 * filling → allotment → fee payment) - adapted here for scholarship /
 * request lifecycle tracking. */
export function StatusTimeline({ steps, current, rejected }: { steps: readonly string[]; current: string; rejected?: boolean }) {
  const currentIdx = steps.indexOf(current === "rejected" ? "submitted" : current);

  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const done = !rejected && i <= currentIdx;
        const isLast = i === steps.length - 1;
        return (
          <div key={step} className={cn("flex items-center", !isLast && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-medium",
                  rejected && i === 0
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : done
                      ? "border-success bg-success text-white"
                      : "border-border bg-card text-muted-foreground",
                )}
              >
                {rejected && i === 0 ? <X className="size-3" /> : done ? <Check className="size-3" /> : i + 1}
              </div>
              <span className={cn("whitespace-nowrap text-[10px]", done ? "font-medium text-foreground" : "text-muted-foreground")}>
                {rejected && i === 0 ? "Rejected" : LABELS[step]}
              </span>
            </div>
            {!isLast && <div className={cn("mx-1 h-0.5 flex-1 rounded-full", !rejected && i < currentIdx ? "bg-success" : "bg-border")} />}
          </div>
        );
      })}
    </div>
  );
}
