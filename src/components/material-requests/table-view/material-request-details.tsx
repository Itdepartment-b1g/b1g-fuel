import type { MaterialRequest } from "@/types/material-requests";
import { MaterialRequestSummary } from "./material-request-summary";
import { MaterialRequestItems } from "./material-request-items";

export function MaterialRequestDetails({ record, fit = false }: { record: MaterialRequest; fit?: boolean }) {
  return <div className="min-w-0 space-y-4">
    <MaterialRequestSummary record={record} />
    <MaterialRequestItems items={record.items} fit={fit} />
  </div>;
}
