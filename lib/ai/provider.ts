/**
 * Pluggable NLU provider interface.
 *
 * The prototype ships a deterministic RuleBasedProvider (see engine.ts) so
 * the whole app works offline with zero API keys. A production build would
 * swap in an LLM-backed provider (e.g. the Anthropic Messages API with
 * native tool use) that implements the exact same contract: read the
 * conversation, decide which tool(s) in lib/ai/tools.ts to call and with
 * what arguments, then hand the tool result back to the same response
 * formatter. Nothing else in the app needs to change.
 */
import { AccessContext } from "@/lib/services/context";
import { ChatMessage, AssistantMessage } from "./types";

export interface AIProvider {
  respond(ctx: AccessContext, message: string, history: ChatMessage[]): Promise<AssistantMessage>;
}
