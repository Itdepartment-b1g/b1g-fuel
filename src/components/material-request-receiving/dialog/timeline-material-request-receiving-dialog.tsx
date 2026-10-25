"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TimelineDialog } from "@/components/common/timeline/timeline-dialog";
import { TimelineLegend } from "@/components/common/timeline/timeline";
import { useListView, ViewToggle } from "@/components/common/filter/search-filter-bar";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { getMaterialRequest } from "@/lib/store/material-requests-slice";
import { materialRequestProgressEntries } from "@/components/material-requests/timeline-entries";
import type { MaterialRequestReceipt } from "@/types/material-requests";

export function TimelineMaterialRequestReceivingDialog({ receipt, onClose }: { receipt: MaterialRequestReceipt; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const detail = useAppSelector((state) => state.materialRequests.detail);
  const [revision, setRevision] = useState(0);
  const [view, setView] = useListView();
  const record = detail.data?.id === receipt.request_id && !detail.loading ? detail.data : null;
  const cutoff = record?.events.findIndex((event) => event.material_request_receiving_id === receipt.id) ?? -1;
  const events = record ? (cutoff < 0 ? record.events : record.events.slice(0, cutoff + 1)) : [];
  const entries = record ? materialRequestProgressEntries({ ...record, events }, view) : [];

  useEffect(() => {
    const request = dispatch(getMaterialRequest(receipt.request_id));
    return () => request.abort();
  }, [dispatch, receipt.request_id, revision]);
  useEffect(() => {
    if (detail.error?.status === 401) router.replace("/login");
  }, [detail.error, router]);

  return (
    <TimelineDialog
      title="Receipt timeline"
      description={record ? `${receipt.receiving_no ?? "Receipt"} · ${record.request_no ?? "Draft"} · ${record.requesting_hub.name}` : "Material request receipt history"}
      entries={entries}
      loading={detail.loading || (!record && !detail.error)}
      error={detail.error?.message}
      onRetry={() => setRevision((value) => value + 1)}
      onClose={onClose}
    >
      <TimelineLegend entries={entries} />
      <ViewToggle view={view} onViewChange={setView} label="Line display" />
    </TimelineDialog>
  );
}
