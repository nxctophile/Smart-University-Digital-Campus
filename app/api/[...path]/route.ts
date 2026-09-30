import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/**
 * Every API route except /api/ai/* is now just this: forward the request to
 * the Rust backend, cookie and all, and relay back whatever it says. The
 * backend owns the DB and re-authorizes every call itself - this file never
 * needs to change as domains get added there.
 */
async function proxy(req: NextRequest) {
  const url = new URL(req.url);
  const target = `${BACKEND_URL}${url.pathname}${url.search}`;

  const headers: Record<string, string> = { cookie: req.headers.get("cookie") ?? "" };
  let body: BodyInit | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  if (!["GET", "HEAD"].includes(req.method)) {
    if (contentType.startsWith("multipart/form-data")) {
      body = await req.formData();
    } else {
      const text = await req.text();
      if (text) {
        body = text;
        headers["content-type"] = contentType || "application/json";
      }
    }
  }

  const res = await fetch(target, { method: req.method, headers, body });

  const outHeaders = new Headers();
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) outHeaders.set("set-cookie", setCookie);
  const responseContentType = res.headers.get("content-type");
  if (responseContentType) outHeaders.set("content-type", responseContentType);

  // Response bodies are forbidden on these statuses by the Fetch spec - the
  // NextResponse constructor throws if one is passed even when it's empty.
  const NO_BODY_STATUSES = new Set([204, 205, 304]);
  const responseBody = NO_BODY_STATUSES.has(res.status) ? null : await res.arrayBuffer();

  return new NextResponse(responseBody, { status: res.status, headers: outHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
