"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AsyncStatus } from "@/components/common/async-status";
import { APP_PATHS } from "@/lib/auth/dashboard";
import { AccountAccessNotice } from "./account-access-notice";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
function getHashError() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.get("error_code") === "signup_disabled") return "account_not_provisioned";
  return params.has("error") || params.has("error_code") ? "google_failed" : null;
}
const getServerHashError = () => null;

export function AuthForm({ initialError = null, initialAccessDenied = false }: { initialError?: string | null; initialAccessDenied?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const busy = useRef(false);
  const pending = loading || googleLoading;
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [callbackDismissed, setCallbackDismissed] = useState(false);
  const hashError = useSyncExternalStore(subscribeToHash, getHashError, getServerHashError);
  const showAccessNotice = !callbackDismissed && (initialAccessDenied || hashError === "account_not_provisioned");
  const displayError = showAccessNotice ? null : error ?? (!callbackDismissed && hashError === "google_failed" ? "Google sign-in did not complete. Please try again." : null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setCallbackDismissed(true);
    const form = new FormData(event.currentTarget);
    setLoading(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Authentication failed.");
      if (body.user) { router.replace(APP_PATHS.home); router.refresh(); }
      else setMessage(body.message);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setLoading(false); busy.current = false; }
  }
  async function signInWithGoogle() {
    if (busy.current) return;
    busy.current = true;
    setCallbackDismissed(true);
    setGoogleLoading(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/auth/google", { method: "POST", credentials: "include" });
      const body = await response.json();
      if (!response.ok || typeof body.url !== "string") throw new Error(body.error ?? "Unable to start Google sign-in.");
      window.location.assign(body.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to start Google sign-in.");
      setGoogleLoading(false); busy.current = false;
    }
  }
  return <main className="mx-auto max-w-md px-6 py-16"><h1 className="mb-2 text-3xl font-bold">Welcome back</h1><p className="mb-8 text-muted-foreground">Sign in to your B1G Fuel workspace.</p>
    {showAccessNotice && <AccountAccessNotice />}
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><label htmlFor="email" className="text-sm font-medium">Email</label><Input id="email" name="email" type="email" autoComplete="email" required disabled={pending} /></div>
      <div className="space-y-2"><label htmlFor="password" className="text-sm font-medium">Password</label><Input id="password" name="password" type="password" minLength={8} autoComplete="current-password" required disabled={pending} /></div>
      <AsyncStatus loading={pending} error={displayError} loadingMessage={googleLoading ? "Opening Google sign-in..." : "Please wait..."} />{message && <p role="status" className="text-sm">{message}</p>}
      <Button type="submit" className="w-full" disabled={pending}>Sign in</Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>or</span><span className="h-px flex-1 bg-border" /></div>
      <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={signInWithGoogle}>
        Continue with Google
      </Button>
    </form>
  </main>;
}
