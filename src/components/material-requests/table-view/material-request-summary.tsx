import type { MaterialRequest } from "@/types/material-requests";
import { formatDate, formatDateTime } from "@/utils/date";
import { MATERIAL_REQUEST_PROGRESS_LABEL } from "@/utils/material-request-progress";

export function MaterialRequestSummary({ record }: { record: MaterialRequest }) {
  return <div className="space-y-4">
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="min-w-0"><dt className="text-muted-foreground">Requesting company / hub</dt><dd className="break-words">{record.requesting_company.name} / {record.requesting_hub.name}</dd></div>
      <div className="min-w-0"><dt className="text-muted-foreground">Supplying company / warehouse</dt><dd className="break-words">{record.supplying_company.name} / {record.supplying_warehouse?.name ?? "Awaiting assignment"}</dd></div>
      <div><dt className="text-muted-foreground">Request progress</dt><dd>{MATERIAL_REQUEST_PROGRESS_LABEL[record.status]}</dd></div>
      <div><dt className="text-muted-foreground">Needed date</dt><dd>{record.needed_at ? formatDate(record.needed_at) : "Not specified"}</dd></div>
      <div><dt className="text-muted-foreground">Created by</dt><dd>{record.created_by_name ?? "Unavailable user"}</dd></div>
      <div><dt className="text-muted-foreground">Submitted at</dt><dd>{record.submitted_at ? formatDateTime(record.submitted_at) : "Not submitted"}</dd></div>
    </dl>
    {record.notes && <div className="text-sm"><h2 className="font-medium">Notes</h2><p className="whitespace-pre-wrap break-words">{record.notes}</p></div>}
  </div>;
}
