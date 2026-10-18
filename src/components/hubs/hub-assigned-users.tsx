"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/pagination";
import { TableView } from "@/components/common/table/table-view";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { listHubAssignmentHistory, selectHub } from "@/lib/store/hubs-slice";
import { canManageHubStaff } from "@/utils/hub-access";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import type { HubSummary } from "@/types/hubs";
import { HUB_ASSIGNMENT_COLUMNS } from "./table-view/hub-assignment-columns";

export function HubAssignedUsers({ hub, revision = 0 }: { hub: HubSummary; revision?: number }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const allowed = canManageHubStaff(access, hub);
  const entry = useAppSelector(selectHub).assignmentHistory[hub.id];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [retry, setRetry] = useState(0);
  const current = entry?.query.page === page && entry.query.page_size === pageSize && !entry.query.search;
  const loading = !current || entry.status === "idle" || entry.status === "loading";
  const error = current ? entry.error : null;
  const data = current ? entry.data : null;

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const request = dispatch(listHubAssignmentHistory({ location_id: hub.id, page, page_size: pageSize }));
    request.then((action) => {
      if (active && listHubAssignmentHistory.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => { active = false; request.abort(); };
  }, [dispatch, allowed, hub.id, page, pageSize, revision, retry]);
  useEffect(() => { if (error?.status === 401) router.replace("/login"); }, [error, router]);

  if (!allowed) return <p className="px-4 pb-4 text-sm text-muted-foreground">Company-level hub edit access is required to view assigned users.</p>;
  return (
    <section aria-label={`Assigned users for ${hub.name}`} aria-busy={loading} className="space-y-3 p-4">
      <div><h3 className="text-sm font-semibold">Assigned users</h3><p className="mt-1 text-xs text-muted-foreground">Current and previous assignments. A dash means the user is still assigned.</p></div>
      {error ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive"><span>{error.message}</span><Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>Try again</Button></div> : (
        <TableView data={data?.assignments ?? []} columns={HUB_ASSIGNMENT_COLUMNS} rowKey={(row) => row.id}
          caption={`Assigned users and assignment history for ${hub.name}`} loading={loading} sortingMode="server"
          className="rounded-lg border bg-white" emptyTitle="No assigned users" emptyDescription="No users have been assigned to this hub yet." />
      )}
      {data && data.total > 0 && <Pagination metadata={paginationFromApi(data)} disabled={loading} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} onPage={setPage}
        onLimitChange={(size) => { setPageSize(size); setPage(1); }} limitOptions={PAGE_SIZE_OPTIONS} />}
    </section>
  );
}
