"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TimelineDialog } from "@/components/common/timeline/timeline-dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { getMaterialRequest } from "@/lib/store/material-requests-slice";
import { materialRequestProgressEntries } from "../timeline-entries";
import { TimelineLegend } from "@/components/common/timeline/timeline";
import {
  useListView,
  ViewToggle,
} from "@/components/common/filter/search-filter-bar";

export function TimelineMaterialRequestDialog({
  requestId,
  onClose,
}: {
  requestId: string;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const detail = useAppSelector((state) => state.materialRequests.detail);
  const [revision, setRevision] = useState(0);
  const [view, setView] = useListView();
  const record =
    detail.data?.id === requestId && !detail.loading ? detail.data : null;
  const entries = record ? materialRequestProgressEntries(record, view) : [];

  useEffect(() => {
    const request = dispatch(getMaterialRequest(requestId));
    return () => request.abort();
  }, [dispatch, requestId, revision]);
  useEffect(() => {
    if (detail.error?.status === 401) router.replace("/login");
  }, [router, detail.error]);

  return (
    <TimelineDialog
      title="Material request timeline"
      description={
        record
          ? `${record.request_no ?? "Draft"} · ${record.requesting_company.name} / ${record.requesting_hub.name}`
          : "Material request history"
      }
      entries={entries}
      loading={detail.loading || (!record && !detail.error)}
      error={detail.error?.message}
      onRetry={() => setRevision((value) => value + 1)}
      onClose={onClose}
    >
      <TimelineLegend entries={entries} />
      <ViewToggle view={view} onViewChange={setView} label="Line display" />
      <p className="text-xs text-muted-foreground">
        Material tables and request details use the current saved values.
        Earlier draft values may differ.
      </p>
    </TimelineDialog>
  );
}
