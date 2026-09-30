import { cookies } from "next/headers";
import type { ClientContext } from "@/lib/types";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export class UnauthenticatedError extends Error {
  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Server Component fetch to the Rust backend, cookie forwarded from the
 * incoming request - the backend re-authorizes independently, same as any
 * other client. */
export async function backendGet<T>(path: string): Promise<T> {
  const cookie = await cookieHeader();
  const res = await fetch(`${BACKEND_URL}${path}`, { headers: { cookie }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new UnauthenticatedError();
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

/** Throws UnauthenticatedError if there's no logged-in demo user - proxy.ts
 * already redirects to /login before a page ever gets this far, so this is
 * a defense-in-depth path, not the real gate (the backend re-checks the
 * cookie on every request regardless). */
export async function getCurrentClientContext(): Promise<ClientContext> {
  const data = await backendGet<{ ctx: ClientContext }>("/api/profile");
  return data.ctx;
}

export async function getCurrentClientContextOrNull(): Promise<ClientContext | null> {
  try {
    return await getCurrentClientContext();
  } catch {
    return null;
  }
}
