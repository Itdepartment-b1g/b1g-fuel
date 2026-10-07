import { AlertCircle, LoaderCircle } from "lucide-react";

export function AsyncStatus({
  loading,
  error,
  loadingMessage = "Loading...",
}: {
  loading: boolean;
  error: string | null;
  loadingMessage?: string;
}) {
  if (loading)
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-muted-foreground"
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        {loadingMessage}
      </p>
    );
  if (error)
    return (
      <p role="alert" className="flex items-center gap-2 text-destructive">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {error}
      </p>
    );
  return null;
}
