/**
 * Real LLM provider backed by Groq's OpenAI-compatible chat completions API
 * with native tool use. It reasons over the exact same tool registry
 * (lib/ai/tools.ts) the rule-based provider uses, so authorization and data
 * access are identical either way - only *how the intent is understood*
 * changes. Sensitive tools are intercepted before execution and turned into
 * a confirm button, same contract as the rule-based path.
 */
import Groq from "groq-sdk";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { AccessContext, AccessDeniedError } from "@/lib/services/context";
import { AssistantMessage, ChatMessage, ToolTrace } from "./types";
import { tools, encodePendingAction } from "./tools";
import { formatToolResult } from "./format-tool-result";
import type { AIProvider } from "./provider";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_TOOL_ROUNDS = 4;

let msgSeq = 0;
function nextId() {
  msgSeq += 1;
  return `am-groq-${Date.now().toString(36)}-${msgSeq}`;
}

function toolsToGroqSchema(): ChatCompletionTool[] {
  return Object.entries(tools).map(([name, def]) => ({
    type: "function",
    function: { name, description: def.description, parameters: def.parameters as Record<string, unknown> },
  }));
}

function systemPrompt(ctx: AccessContext): string {
  return `You are "AI", the assistant inside Campus OS - a digital campus platform for Central Institute of Technology. You are talking to a logged-in ${ctx.role} named ${ctx.name}.

Rules:
- Never invent data. Only state facts you retrieved via a tool call in this conversation.
- For any question about attendance, fees, timetable, exams, certificates, hostel, transport, library, scholarships, or student records, call the relevant tool - do not answer from memory.
- Keep replies short (1-3 sentences) and concrete. The UI renders structured cards/tables alongside your text, so do not repeat numbers in prose that are already in a card - just summarize the takeaway.
- Tools marked sensitive (creating a helpdesk ticket, notifying students/parents, applying for a scholarship) require the user's explicit confirmation. When the user's intent implies one of these, briefly state what you're about to do and call the tool anyway - the system will convert it into a confirmation button automatically. Do not ask "should I proceed?" in text; the confirm button handles that.
- If the caller is a student or parent, tools default to their own/their child's records - you never need to pass a studentId for those.
- If the caller is faculty or admin, tools like get_at_risk_students / search_students / notify_students operate across students - pass filters based on what the user asked.
- If a tool call returns an "error" field about access/permission, relay it naturally as-is (e.g. "I don't have access to that information for your account.") - never guess at, invent, or reveal what the hidden data might have been, any internal id, or why access was denied.
- Today's date is ${new Date().toISOString().slice(0, 10)}.`;
}

function historyToGroqMessages(history: ChatMessage[]): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [];
  for (const msg of history) {
    if (msg.role === "user") {
      out.push({ role: "user", content: msg.text });
    } else {
      out.push({ role: "assistant", content: msg.text || "(no reply text)" });
      const studentIds = msg.meta?.studentIds;
      if (Array.isArray(studentIds) && studentIds.length) {
        out.push({ role: "user", content: `[system note - not visible to the user: the last query above matched student ids ${studentIds.join(", ")}]` });
      }
    }
  }
  return out;
}

function reply(text: string, opts: Partial<Omit<AssistantMessage, "id" | "role" | "text">> = {}): AssistantMessage {
  return {
    id: nextId(),
    role: "assistant",
    text,
    toolTrace: opts.toolTrace ?? [],
    cards: opts.cards ?? [],
    actions: opts.actions ?? [],
    meta: opts.meta,
  };
}

export class GroqProvider implements AIProvider {
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async respond(ctx: AccessContext, message: string, history: ChatMessage[]): Promise<AssistantMessage> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt(ctx) },
      ...historyToGroqMessages(history),
      { role: "user", content: message },
    ];
    const toolSchemas = toolsToGroqSchema();
    const trace: ToolTrace[] = [];
    let lastToolName: string | null = null;
    let lastToolResult: unknown = null;

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const completion = await this.client.chat.completions.create({
          model: MODEL,
          messages,
          tools: toolSchemas,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 500,
        });

        const choice = completion.choices[0]?.message;
        if (!choice) break;

        const toolCalls = choice.tool_calls ?? [];
        if (!toolCalls.length) {
          const formatted = lastToolName ? formatToolResult(lastToolName, lastToolResult) : { cards: [], actions: [] };
          return reply(choice.content || "Done.", { toolTrace: trace, cards: formatted.cards, actions: formatted.actions, meta: formatted.meta });
        }

        const sensitiveCall = toolCalls.find((tc) => tools[tc.function.name]?.sensitive);
        if (sensitiveCall) {
          const args = safeParseArgs(sensitiveCall.function.arguments);
          const payload = encodePendingAction({
            tool: sensitiveCall.function.name,
            args,
            successText: successTextFor(sensitiveCall.function.name, args),
          });
          return reply(choice.content || `I can do that - want me to go ahead?`, {
            toolTrace: trace,
            actions: [
              { id: "confirm", label: confirmLabelFor(sensitiveCall.function.name), kind: "confirm", payload, style: "primary" },
              { id: "cancel", label: "Not now", kind: "confirm", payload: encodePendingAction({ tool: "noop", args: {}, successText: "No problem." }) },
            ],
          });
        }

        // Non-sensitive calls: execute and feed results back for the model to synthesize.
        messages.push({ role: "assistant", content: choice.content, tool_calls: toolCalls });
        for (const call of toolCalls) {
          const def = tools[call.function.name];
          const args = safeParseArgs(call.function.arguments);
          let result: unknown;
          try {
            result = def ? await def.run(ctx, args) : { error: `Unknown tool ${call.function.name}` };
          } catch (err) {
            // Never let a permission error's internals (which record/field
            // was denied) reach the model - it would just relay them.
            const message = err instanceof AccessDeniedError
              ? "I don't have access to that information for your account."
              : err instanceof Error ? err.message : "Tool call failed";
            result = { error: message };
          }
          trace.push({ tool: call.function.name, summary: def?.description ?? call.function.name });
          lastToolName = call.function.name;
          lastToolResult = result;
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }
      }

      const formatted = lastToolName ? formatToolResult(lastToolName, lastToolResult) : { cards: [], actions: [] };
      return reply("Here's what I found.", { toolTrace: trace, cards: formatted.cards, actions: formatted.actions, meta: formatted.meta });
    } catch (err) {
      return reply(`I hit an error talking to the AI model: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function confirmLabelFor(toolName: string): string {
  if (toolName === "create_helpdesk_ticket") return "Create ticket";
  if (toolName === "notify_students") return "Send notification";
  if (toolName === "apply_for_scholarship") return "Submit application";
  return "Confirm";
}

function successTextFor(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "create_helpdesk_ticket") return `Ticket created for "${args.subject ?? "your request"}".`;
  if (toolName === "notify_students") {
    const count = Array.isArray(args.studentIds) ? args.studentIds.length : 0;
    return `Notified ${count} ${args.channel === "parent" ? "parent(s)" : "student(s)"}.`;
  }
  if (toolName === "apply_for_scholarship") return "Scholarship application submitted.";
  return "Done.";
}
