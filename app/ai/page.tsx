import { Suspense } from "react";
import { getCurrentContext } from "@/lib/demo-session";
import { ChatPanel } from "@/components/ai/chat-panel";

const PROMPTS: Record<string, string[]> = {
  student: [
    "Can I miss tomorrow's DBMS class?",
    "Show my fee status",
    "Get my bonafide certificate",
    "When is my next class?",
    "Report a hostel Wi-Fi issue",
  ],
  parent: ["Show my child's attendance", "What is the pending fee?", "Any upcoming exams?"],
  faculty: ["Show my students below 75% attendance", "Which of my students have exams this week?"],
  admin: [
    "Show students with attendance below 75% who have exams this week",
    "Show at-risk students in Computer Science",
    "Notify their parents",
  ],
};

export default async function AiPage() {
  const ctx = await getCurrentContext();
  const prompts = PROMPTS[ctx.role] ?? PROMPTS.student;
  const poweredBy = process.env.GROQ_API_KEY ? "Groq" : "rule-based";

  return (
    <Suspense>
      <ChatPanel suggestedPrompts={prompts} poweredBy={poweredBy} />
    </Suspense>
  );
}
