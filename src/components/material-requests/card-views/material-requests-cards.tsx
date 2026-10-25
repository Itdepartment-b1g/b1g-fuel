"use client";

import { Button } from "@/components/ui/button";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import type { MaterialRequest } from "@/types/material-requests";
import { formatDateTime } from "@/utils/date";
import { materialRequestActions, type MaterialRequestActionProps } from "../table-view/material-requests-table-view";
import { materialRequestReviewer } from "../table-view/material-requests-table-columns";

export function MaterialRequestsCards(props: MaterialRequestActionProps & { rows: MaterialRequest[] }) {
  return <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
    {props.rows.map((row) => <article key={row.id} className="flex flex-col rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold break-words">{row.request_no ?? "Draft"}</h2>
        <CardActionsMenu label={`Actions for ${row.request_no ?? "draft request"}`} disabled={props.disabled} items={materialRequestActions(row, props).map((action) => ({ id: action.id, label: action.label, onSelect: () => action.onSelect(row) }))} />
      </div>
      <p className="mt-2 text-sm capitalize">{row.status}</p>
      <dl className="mt-4 space-y-3 text-sm">
        <div><dt className="text-muted-foreground">Requesting company / hub</dt><dd className="break-words">{row.requesting_company.name} / {row.requesting_hub.name}</dd></div>
        <div><dt className="text-muted-foreground">Supplier</dt><dd className="break-words">{row.supplying_company.name}</dd></div>
        <div><dt className="text-muted-foreground">Reviewed by</dt><dd>{materialRequestReviewer(row)}</dd></div>
        <div><dt className="text-muted-foreground">Created at</dt><dd>{formatDateTime(row.created_at)}</dd></div>
      </dl>
      <div className="mt-auto pt-5"><Button variant="outline" size="sm" className="w-full" disabled={props.disabled} onClick={() => props.onView(row)}>{row.status === "draft" ? "View draft" : "View"}</Button></div>
    </article>)}
  </div>;
}
