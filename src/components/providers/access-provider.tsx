"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { RecordAccess } from "@/lib/auth/access-scope";

const AccessContext = createContext<RecordAccess | null>(null);
const RefreshAccessContext = createContext<() => Promise<void>>(async () => {});

export function AccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<RecordAccess | null>(null);
  const currentRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    currentRequest.current?.abort();
    const request = new AbortController();
    currentRequest.current = request;
    return fetch("/api/auth/session", { credentials: "include", cache: "no-store", signal: request.signal }).then(async (response) => {
      if (response.ok) {
        const data = await response.json();
        if (!request.signal.aborted) setAccess(data.access ?? null);
      } else if (!request.signal.aborted && (response.status === 401 || response.status === 403)) setAccess(null);
    }).catch(() => { /* Keep the last successful access snapshot during a temporary network failure. */ });
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      currentRequest.current?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  return <RefreshAccessContext.Provider value={refresh}><AccessContext.Provider value={access}>{children}</AccessContext.Provider></RefreshAccessContext.Provider>;
}

export function useRecordAccess() { return useContext(AccessContext); }
export function useRefreshRecordAccess() { return useContext(RefreshAccessContext); }
