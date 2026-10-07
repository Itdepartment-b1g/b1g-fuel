import { ShieldAlert } from "lucide-react";

export function AccountAccessNotice() {
  return (
    <section role="alert" aria-labelledby="account-access-title" className="mb-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <h2 id="account-access-title" className="text-sm font-semibold">Account not registered</h2>
        <p className="mt-1 text-sm leading-relaxed">
          This email address isn’t registered with our organization. Contact your administrator to request access, or sign in with an account that’s already registered.
        </p>
      </div>
    </section>
  );
}
