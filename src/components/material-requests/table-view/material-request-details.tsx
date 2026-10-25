import type { MaterialRequest } from "@/types/material-requests";
import { Timeline } from "@/components/common/timeline/timeline";
import { materialRequestTimelineEntries } from "../timeline-entries";
import { MaterialRequestSummary } from "./material-request-summary";
import { MaterialRequestItems } from "./material-request-items";

export function MaterialRequestDetails({ record }: { record: MaterialRequest }) {
  return <div className="space-y-4">
    <MaterialRequestSummary record={record} />
    <MaterialRequestItems items={record.items} />
    <section className="space-y-3 border-t pt-4">
      <h2 className="font-semibold">Timeline</h2>
      <Timeline entries={materialRequestTimelineEntries(record.events)} />
    </section>
  </div>;
}
