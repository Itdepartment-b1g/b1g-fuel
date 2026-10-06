"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AsyncStatus } from "@/components/common/async-status";
import { APP_PATHS } from "@/lib/auth/dashboard";

export function AuthForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Authentication failed.");
      if (body.user) { router.replace(APP_PATHS.home); router.refresh(); }
      else setMessage(body.message);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setLoading(false); }
  }
  return <main className="mx-auto max-w-md px-6 py-16"><h1 className="mb-2 text-3xl font-bold">Welcome back</h1><p className="mb-8 text-muted-foreground">Sign in to your B1G Fuel workspace.</p>
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><label htmlFor="email" className="text-sm font-medium">Email</label><Input id="email" name="email" type="email" autoComplete="email" required disabled={loading} /></div>
      <div className="space-y-2"><label htmlFor="password" className="text-sm font-medium">Password</label><Input id="password" name="password" type="password" minLength={8} autoComplete="current-password" required disabled={loading} /></div>
      <AsyncStatus loading={loading} error={error} loadingMessage="Please wait..." />{message && <p role="status" className="text-sm">{message}</p>}
      <Button type="submit" className="w-full" disabled={loading}>Sign in</Button>
    </form>
  </main>;
}
