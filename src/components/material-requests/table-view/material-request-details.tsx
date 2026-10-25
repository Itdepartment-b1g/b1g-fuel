import type { MaterialRequest, RequestMovement } from "@/types/material-requests";
import { formatDateTime } from "@/utils/date";
import { MaterialRequestSummary } from "./material-request-summary";
import { MaterialRequestItems } from "./material-request-items";

export function MaterialRequestDetails({ record, fit = false }: { record: MaterialRequest; fit?: boolean }) {
  const history = [
    ...(record.dispatches ?? []).map((row) => ({ ...row, kind: "Dispatch" })),
    ...(record.receivings ?? []).map((row) => ({ ...row, kind: "Receipt" })),
  ].sort((left, right) => (left.posted_at ?? "").localeCompare(right.posted_at ?? ""));
  return <div className="min-w-0 space-y-4">
    <MaterialRequestSummary record={record} />
    <MaterialRequestItems items={record.items} fit={fit} />
    <MovementHistory record={record} history={history} />
  </div>;
}

function MovementHistory({ record, history }: { record: MaterialRequest; history: (RequestMovement & { kind: string })[] }) {
  return <section className="min-w-0 space-y-2">
    <h3 className="font-semibold">Dispatch and receiving history</h3>
    {!history.length && <p className="text-sm text-muted-foreground">No dispatch or receipt yet.</p>}
    {history.map((row) => <article key={row.id} className="rounded-md border p-3 text-sm">
      <p className="font-medium">{row.kind} {row.number ?? "Unnumbered"}</p>
      <p className="text-muted-foreground">{row.posted_at ? formatDateTime(row.posted_at) : "Not posted"} · {row.created_by_name ?? "Unavailable user"} · Posted</p>
      <ul className="mt-2 space-y-1">{row.lines.map((line) => {
        const item = record.items.find((requestItem) => requestItem.id === line.material_request_item_id);
        return <li key={line.material_request_item_id}>{item?.product_label ?? "Material"} · {line.qty} {item?.unit_label ?? ""}</li>;
      })}</ul>
    </article>)}
  </section>;
}
