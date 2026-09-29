import { NextResponse } from "next/server";
import { AccessDeniedError, UnauthenticatedError } from "@/lib/services/context";

export function handleApiError(err: unknown) {
  if (err instanceof UnauthenticatedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof AccessDeniedError) return NextResponse.json({ error: err.message }, { status: 403 });
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 400 });
}
