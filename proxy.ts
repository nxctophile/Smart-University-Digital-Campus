import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/demo-session-constants";

/**
 * UX-only redirect to/from /login based on cookie *presence*. This is not
 * the security boundary - every API route and service function
 * independently re-authorizes via getCurrentContext() regardless (see
 * CLAUDE.md's "everything funnels through the service layer" section).
 * Proxy just avoids flashing the authenticated shell before a real check
 * would fail.
 */
export function proxy(request: NextRequest) {
  const isLoggedIn = request.cookies.has(DEMO_COOKIE);
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except API routes, static assets, and PWA files - those
    // either authorize themselves independently (API) or must always be
    // reachable regardless of login state (manifest/service worker/samples).
    "/((?!api|_next/static|_next/image|sw\\.js|manifest\\.webmanifest|samples|.*\\.svg$).*)",
  ],
};
