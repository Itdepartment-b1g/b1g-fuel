import type { ReactNode } from "react";
import { Clock3 } from "lucide-react";
import { formatDateTime } from "@/utils/date";

export type TimelineEntry = {
  id: string;
  title: string;
  occurredAt: string;
  actorName: string | null;
  note?: string;
  icon?: ReactNode;
  tone?: "info" | "warning" | "success" | "danger" | "neutral";
  content?: ReactNode;
};

const MARK_COLOR = {
  info: "border-sky-300 bg-sky-50 text-sky-700",
  warning: "border-amber-300 bg-amber-50 text-amber-700",
  success: "border-emerald-300 bg-emerald-50 text-emerald-700",
  danger: "border-red-300 bg-red-50 text-red-700",
  neutral: "border-slate-300 bg-slate-100 text-slate-700",
};

export function Timeline({ entries }: { entries: readonly TimelineEntry[] }) {
  if (!entries.length)
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol
      aria-label="Timeline"
      className="ml-4 space-y-8 border-l border-border pl-6"
    >
      {entries.map((entry) => (
        <li key={entry.id} className="relative min-w-0">
          <span
            aria-hidden="true"
            className={`absolute -left-[38px] top-0 flex size-7 items-center justify-center rounded-full border [&_svg]:size-3.5 ${MARK_COLOR[entry.tone ?? "neutral"]}`}
          >
            {entry.icon ?? <Clock3 />}
          </span>
          <h3 className="font-semibold break-words">{entry.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            <time dateTime={entry.occurredAt}>
              {formatDateTime(entry.occurredAt)}
            </time>
          </p>
          <p className="mt-1 text-sm break-words">
            {entry.actorName || "Unavailable user"}
          </p>
          {entry.note && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
              {entry.note}
            </p>
          )}
          {entry.content && (
            <div className="mt-4 space-y-5">{entry.content}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
