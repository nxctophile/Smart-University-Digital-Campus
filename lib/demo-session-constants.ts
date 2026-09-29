/**
 * Deliberately dependency-free (no db/schema imports) so `proxy.ts` can read
 * the cookie name without pulling the better-sqlite3 client into the proxy
 * bundle - see the "Proxy... you should not attempt relying on shared
 * modules or globals" guidance in the Next.js docs.
 */
export const DEMO_COOKIE = "campus_demo_user";
