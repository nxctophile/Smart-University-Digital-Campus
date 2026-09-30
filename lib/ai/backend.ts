import type { ClientContext } from "@/lib/types";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "BackendError";
    this.status = status;
  }
}

export async function backendFetch<T>(cookie: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), cookie, ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new BackendError(res.status, body.error ?? "Request failed");
  return body as T;
}

export type Caller = { cookie: string; client: ClientContext };

export async function loadCaller(cookie: string): Promise<Caller> {
  const data = await backendFetch<{ ctx: ClientContext }>(cookie, "/api/profile");
  return { cookie, client: data.ctx };
}

export function backendErrorResponse(err: unknown) {
  if (err instanceof BackendError) return Response.json({ error: err.message }, { status: err.status });
  return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 400 });
}
