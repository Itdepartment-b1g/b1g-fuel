import { CircleCheck, CircleX, FilePlus, PackageCheck, Pencil, Send, Ban, Truck } from "lucide-react";
import type { TimelineEntry } from "@/components/common/timeline/timeline";
import type { MaterialRequest, RequestEvent } from "@/types/material-requests";
import type { ListView } from "@/components/common/filter/search-filter-bar";
import { MaterialRequestSummary } from "./table-view/material-request-summary";
import { MaterialRequestItems } from "./table-view/material-request-items";
import { formatDate } from "@/utils/date";
import { MATERIAL_REQUEST_PROGRESS_LABEL } from "@/utils/material-request-progress";

const EVENT_STYLE: Record<string, Pick<TimelineEntry, "title" | "icon" | "tone">> = {
  created: { title: "Request created", icon: <FilePlus />, tone: "info" },
  updated: { title: "Draft updated", icon: <Pencil />, tone: "neutral" },
  submitted: { title: "Submitted for review", icon: <Send />, tone: "warning" },
  approved: { title: "Request approved", icon: <CircleCheck />, tone: "success" },
  rejected: { title: "Request rejected", icon: <CircleX />, tone: "danger" },
  cancelled: { title: "Request cancelled", icon: <Ban />, tone: "neutral" },
  receipt_posted: { title: "Receipt posted", icon: <PackageCheck />, tone: "success" },
  dispatched: { title: "Materials dispatched", icon: <Truck />, tone: "info" },
  closed: { title: "Request closed", icon: <Ban />, tone: "neutral" },
};

export function materialRequestTimelineEntries(events: RequestEvent[]): TimelineEntry[] {
  return events.map((event) => ({
    id: event.id, ...(EVENT_STYLE[event.kind] ?? { title: event.kind }),
    occurredAt: event.created_at, actorName: event.created_by_name, note: event.note,
  }));
}

export function materialRequestProgressEntries(record: MaterialRequest, view: ListView): TimelineEntry[] {
  // shortcut: past draft values are not stored; add event snapshots when historical quantities are needed.
  return materialRequestTimelineEntries(record.events).map((entry, index) => {
    const event = record.events[index];
    const approved = event.to_status === "approved" || event.to_status === "partially_dispatched" || event.to_status === "fully_dispatched" || event.to_status === "partially_received" || event.to_status === "received" || event.to_status === "closed";
    const items = approved ? record.items : record.items.map((item) => ({ ...item, approved_qty: null }));
    return { ...entry, content: <>
      {event.kind === "created" ? <MaterialRequestSummary record={{ ...record, status: event.to_status, supplying_warehouse: approved ? record.supplying_warehouse : null, submitted_at: null }} /> :
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Request progress</dt><dd className="mt-1 font-semibold">{MATERIAL_REQUEST_PROGRESS_LABEL[event.to_status]}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Supplying warehouse</dt><dd className="mt-1 font-medium">{approved ? record.supplying_warehouse?.name ?? "Unavailable warehouse" : "Awaiting assignment"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Needed date</dt><dd className="mt-1 font-medium">{record.needed_at ? formatDate(record.needed_at) : "Not specified"}</dd></div>
        </dl>}
      <MaterialRequestItems items={items} view={view} />
    </> };
  });
}
