"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { RecordAccess } from "@/lib/auth/access-scope";

const AccessContext = createContext<RecordAccess | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<RecordAccess | null>(null);
  useEffect(() => {
    const request = new AbortController();
    fetch("/api/auth/session", { credentials: "include", signal: request.signal })
      .then(async (response) => { if (response.ok) { const data = await response.json(); if (!request.signal.aborted) setAccess(data.access ?? null); } })
      .catch(() => {});
    return () => request.abort();
  }, []);
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export function useRecordAccess() { return useContext(AccessContext); }
