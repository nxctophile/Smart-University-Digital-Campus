"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // avoid caching dev HMR bundles
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
