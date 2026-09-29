export type ActionButton = {
  id: string;
  label: string;
  style?: "primary" | "secondary" | "destructive";
  kind: "confirm" | "link";
  /** Base64-encoded pending tool call, decoded + executed on confirm. */
  payload?: string;
  href?: string;
};

export type AICard =
  | { type: "checklist"; title: string; items: { label: string; passed: boolean; detail?: string }[] }
  | { type: "table"; title: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[] }
  | { type: "stat"; title: string; value: string; detail?: string; tone?: "default" | "warning" | "success" }
  | { type: "certificate"; title: string; verificationCode: string; issuedAt: string; purpose?: string; certType: string }
  | { type: "risk"; title: string; factors: { label: string; detail: string; severity: string }[] };

export type ToolTrace = { tool: string; summary: string };

export type AssistantMessage = {
  id: string;
  role: "assistant";
  text: string;
  toolTrace: ToolTrace[];
  cards: AICard[];
  actions: ActionButton[];
  meta?: Record<string, unknown>;
};

export type UserMessage = { id: string; role: "user"; text: string };
export type ChatMessage = UserMessage | AssistantMessage;

export type PendingAction = {
  tool: string;
  args: Record<string, unknown>;
  successText: string;
};
