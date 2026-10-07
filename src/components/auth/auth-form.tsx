"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AsyncStatus } from "@/components/common/async-status";
import { APP_PATHS } from "@/lib/auth/dashboard";
import { AccountAccessNotice } from "./account-access-notice";
import { BrandLogo } from "./brand-logo";
import { LoginBrandPanel } from "./login-brand-panel";
import styles from "./auth-form.module.css";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
function getHashError() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.get("error_code") === "signup_disabled")
    return "account_not_provisioned";
  return params.has("error") || params.has("error_code")
    ? "google_failed"
    : null;
}
const getServerHashError = () => null;

export function AuthForm({
  initialError = null,
  initialAccessDenied = false,
}: {
  initialError?: string | null;
  initialAccessDenied?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const pending = loading || googleLoading;
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [callbackDismissed, setCallbackDismissed] = useState(false);
  const hashError = useSyncExternalStore(
    subscribeToHash,
    getHashError,
    getServerHashError,
  );
  const showAccessNotice =
    !callbackDismissed &&
    (initialAccessDenied || hashError === "account_not_provisioned");
  const displayError = showAccessNotice
    ? null
    : (error ??
      (!callbackDismissed && hashError === "google_failed"
        ? "Google sign-in did not complete. Please try again."
        : null));
  useEffect(() => {
    try {
      const rememberedEmail = localStorage.getItem("b1g-fuel.login-email");
      if (rememberedEmail && emailInput.current && !emailInput.current.value)
        emailInput.current.value = rememberedEmail;
    } catch {
      /* Login remains available when browser storage is disabled. */
    }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setCallbackDismissed(true);
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Authentication failed.");
      if (body.user) {
        try {
          if (form.get("remember_email"))
            localStorage.setItem(
              "b1g-fuel.login-email",
              String(form.get("email") ?? "").trim(),
            );
          else localStorage.removeItem("b1g-fuel.login-email");
        } catch {
          /* Saving an email is optional and must not block authentication. */
        }
        router.replace(APP_PATHS.home);
        router.refresh();
      } else setMessage(body.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }
  async function signInWithGoogle() {
    if (busy.current) return;
    busy.current = true;
    setCallbackDismissed(true);
    setGoogleLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json();
      if (!response.ok || typeof body.url !== "string")
        throw new Error(body.error ?? "Unable to start Google sign-in.");
      window.location.assign(body.url);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to start Google sign-in.",
      );
      setGoogleLoading(false);
      busy.current = false;
    }
  }
  return (
    <main className={styles.screen}>
      <LoginBrandPanel />
      <section className={styles.formPanel} aria-labelledby="login-title">
        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <BrandLogo compact />
            <h1 id="login-title">Welcome back</h1>
            <p>Sign in to your B1G Fuel workspace.</p>
          </header>
          {showAccessNotice && <AccountAccessNotice />}
          <form onSubmit={submit} className={styles.form} aria-busy={pending}>
            <div>
              <label htmlFor="email" className={styles.fieldLabel}>
                Email
              </label>
              <div className={styles.inputWrap}>
                <Mail className={styles.inputIcon} aria-hidden="true" />
                <Input
                  ref={emailInput}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email address"
                  required
                  disabled={pending}
                  className={styles.input}
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className={styles.fieldLabel}>
                Password
              </label>
              <div className={styles.inputWrap}>
                <LockKeyhole className={styles.inputIcon} aria-hidden="true" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  minLength={8}
                  required
                  disabled={pending}
                  className={`${styles.input} ${styles.passwordInput}`}
                />
                <button
                  type="button"
                  className={styles.visibilityButton}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  disabled={pending}
                >
                  {showPassword ? (
                    <Eye className="size-5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <div className={styles.options}>
              <label className={styles.remember}>
                <input
                  type="checkbox"
                  name="remember_email"
                  defaultChecked
                  disabled={pending}
                />
                Remember email
              </label>
            </div>
            {(pending || displayError || message) && (
              <div className={styles.status}>
                <AsyncStatus
                  loading={pending}
                  error={displayError}
                  loadingMessage={
                    googleLoading
                      ? "Opening Google sign-in..."
                      : "Please wait..."
                  }
                />
                {message && <p role="status">{message}</p>}
              </div>
            )}
            <Button type="submit" className={styles.signIn} disabled={pending}>
              Sign in
              <ArrowRight className="size-5" aria-hidden="true" />
            </Button>
            <div className={styles.divider}>or</div>
            <Button
              type="button"
              variant="outline"
              className={styles.google}
              disabled={pending}
              onClick={signInWithGoogle}
            >
              <svg className="size-6" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
                />
              </svg>
              Continue with Google
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
