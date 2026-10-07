"use client";

import { useState, useSyncExternalStore } from "react";

type LoginFeedback = { accessDenied: boolean; error: string | null };

/** Keep callback feedback for this visit while removing it from the reload URL. */
export function useLoginFeedback(initial: LoginFeedback) {
  const [store] = useState(() => {
    const serverSnapshot = initial;
    let snapshot = initial;
    return {
      getSnapshot: () => snapshot,
      getServerSnapshot: () => serverSnapshot,
      subscribe(onChange: () => void) {
        const consume = () => {
          const url = new URL(window.location.href);
          const fragment = new URLSearchParams(url.hash.slice(1));
          const callbackCode = url.searchParams.get("auth_error");
          const hasProviderError = [url.searchParams, fragment].some((params) => params.has("error") || params.has("error_code"));
          if (!url.searchParams.has("auth_error") && !hasProviderError) return;
          const accessDenied = callbackCode === "account_not_provisioned"
            || [url.searchParams, fragment].some((params) => params.get("error_code") === "signup_disabled");
          snapshot = {
            accessDenied,
            error: !accessDenied && (callbackCode === "google_failed" || hasProviderError) ? "Google sign-in did not complete. Please try again." : null,
          };
          url.searchParams.delete("auth_error");
          for (const params of [url.searchParams, fragment]) {
            for (const key of ["error", "error_code", "error_description"]) params.delete(key);
          }
          // Preserve unrelated fragments, such as anchors, when they contain no OAuth error.
          if (new URLSearchParams(url.hash.slice(1)).has("error") || new URLSearchParams(url.hash.slice(1)).has("error_code")) {
            url.hash = fragment.toString();
          }
          window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
          onChange();
        };
        window.addEventListener("hashchange", consume);
        consume();
        return () => window.removeEventListener("hashchange", consume);
      },
    };
  });
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
