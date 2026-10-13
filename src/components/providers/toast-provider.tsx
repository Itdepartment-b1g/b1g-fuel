"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CheckCircle2, X } from "lucide-react";

type Toast = { id: number; message: string; kind: "success" | "error" };
type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function ToastMessage({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.kind === "error" ? 8000 : 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.kind, dismiss, hovered, focused]);

  const Icon = toast.kind === "success" ? CheckCircle2 : CircleAlert;
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 text-sm shadow-lg ${toast.kind === "success" ? "border-emerald-200 text-emerald-800" : "border-red-200 text-destructive"}`}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words">{toast.message}</p>
      <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)} className="shrink-0 rounded p-1 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const notify = useCallback((message: string, kind: Toast["kind"]) => {
    const id = ++nextId.current;
    setToasts((current) => [...current.slice(-3), { id, message, kind }]);
  }, []);
  const api = useMemo<ToastApi>(() => ({
    success: (message) => notify(message, "success"),
    error: (message) => notify(message, "error"),
  }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-label="Notifications" className="pointer-events-none fixed top-4 left-1/2 z-[100] flex w-[calc(100%_-_2rem)] max-w-96 -translate-x-1/2 flex-col gap-3">
        {toasts.map((toast) => <ToastMessage key={toast.id} toast={toast} dismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside ToastProvider.");
  return toast;
}

export function toastErrorMessage(error: unknown, fallback: string) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;
}
