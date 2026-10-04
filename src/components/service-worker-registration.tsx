"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds (in dev it would cache stale chunks during hot reload). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the app works without offline support.
    });
  }, []);
  return null;
}
