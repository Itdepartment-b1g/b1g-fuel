import {
  TableView,
  type TableColumn,
} from "@/components/common/table/table-view";
import type { MaterialRequest, RequestItem } from "@/types/material-requests";
import { formatDate, formatDateTime } from "@/utils/date";
import {
  Timeline,
  type TimelineEntry,
} from "@/components/common/timeline/timeline";
import {
  CircleCheck,
  CircleX,
  FilePlus,
  Pencil,
  Send,
  Ban,
} from "lucide-react";

const EVENT_STYLE: Record<
  string,
  Pick<TimelineEntry, "title" | "icon" | "tone">
> = {
  created: { title: "Request created", icon: <FilePlus />, tone: "info" },
  updated: { title: "Draft updated", icon: <Pencil />, tone: "neutral" },
  submitted: { title: "Submitted for review", icon: <Send />, tone: "warning" },
  approved: {
    title: "Request approved",
    icon: <CircleCheck />,
    tone: "success",
  },
  rejected: { title: "Request rejected", icon: <CircleX />, tone: "danger" },
  cancelled: { title: "Request cancelled", icon: <Ban />, tone: "neutral" },
};

const itemColumns: TableColumn<RequestItem>[] = [
  { id: "product", header: "Material", value: (item) => item.product_label },
  { id: "unit", header: "Unit", value: (item) => item.unit_label },
  { id: "requested", header: "Requested", value: (item) => item.requested_qty },
  {
    id: "approved",
    header: "Approved",
    value: (item) => item.approved_qty ?? "—",
  },
];

export function MaterialRequestDetails({
  record,
}: {
  record: MaterialRequest;
}) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Requesting company / hub</dt>
          <dd>
            {record.requesting_company.name} / {record.requesting_hub.name}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            Supplying company / warehouse
          </dt>
          <dd>
            {record.supplying_company.name} /{" "}
            {record.supplying_warehouse?.name ?? "Awaiting assignment"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="capitalize">{record.status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Needed date</dt>
          <dd>
            {record.needed_at ? formatDate(record.needed_at) : "Not specified"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created by</dt>
          <dd>{record.created_by_name ?? "Unavailable user"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Submitted at</dt>
          <dd>
            {record.submitted_at
              ? formatDateTime(record.submitted_at)
              : "Not submitted"}
          </dd>
        </div>
      </dl>
      {record.notes && (
        <div className="text-sm">
          <h2 className="font-medium">Notes</h2>
          <p className="whitespace-pre-wrap break-words">{record.notes}</p>
        </div>
      )}
      <TableView
        data={record.items}
        rowKey={(item) => item.id}
        caption="Requested materials"
        sortingMode="server"
        columns={itemColumns}
      />
      <section className="space-y-3 border-t pt-4">
        <h2 className="font-semibold">Timeline</h2>
        <Timeline
          entries={record.events.map((event) => ({
            id: event.id,
            ...(EVENT_STYLE[event.kind] ?? { title: event.kind }),
            occurredAt: event.created_at,
            actorName: event.created_by_name,
            note: event.note,
          }))}
        />
      </section>
    </div>
  );
}
