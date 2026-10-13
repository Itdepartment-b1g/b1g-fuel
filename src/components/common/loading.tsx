import { LoaderCircle } from "lucide-react";

export function Loading() {
  return (
    <div className="px-6 py-16 text-center">
      <p
        role="status"
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        Loading…
      </p>
    </div>
  );
}
