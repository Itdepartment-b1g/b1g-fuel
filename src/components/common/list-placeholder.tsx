import { LoaderCircle } from "lucide-react";

export function ListPlaceholder({
  loading,
  title,
  description,
}: {
  loading: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="px-6 py-16 text-center">
      {loading ? (
        <p
          role="status"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          Loading…
        </p>
      ) : (
        <>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </>
      )}
    </div>
  );
}
