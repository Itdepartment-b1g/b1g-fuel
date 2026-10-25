"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/common/loading";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar, useListView } from "@/components/common/filter/search-filter-bar";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearMaterialRequestMutation, getMaterialRequestFilterOption, listMaterialRequest } from "@/lib/store/material-requests-slice";
import { canPerform } from "@/lib/auth/access-scope";
import { useRecordAccess } from "@/components/providers/access-provider";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import { countActiveFilters, createQuickFilterState } from "@/utils/quick-filter";
import { MATERIAL_REQUEST_FILTER_DEFAULTS, MATERIAL_REQUEST_FILTER_OPTIONS } from "@/utils/material-request-filters";
import type { TableSort } from "@/types/table-views";
import { MaterialRequestsTableView, type MaterialRequestActionProps } from "./table-view/material-requests-table-view";
import { MaterialRequestsCards } from "./card-views/material-requests-cards";
import { CreateMaterialRequestDialog } from "./dialog/create-material-request-dialog";
import { EditMaterialRequestDialog } from "./dialog/edit-material-request-dialog";
import { ViewMaterialRequestDialog } from "./dialog/view-material-request-dialog";
import { TimelineMaterialRequestDialog } from "./dialog/timeline-material-request-dialog";

export default function MaterialRequestsList() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const state = useAppSelector((state) => state.materialRequests);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() => createQuickFilterState(MATERIAL_REQUEST_FILTER_DEFAULTS));
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useListView();
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "">("");
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canView = canPerform(access, "materialRequests", "view");
  const activeFilters = countActiveFilters(filters, MATERIAL_REQUEST_FILTER_DEFAULTS);
  const filterOptions = state.filterOptions.data ?? MATERIAL_REQUEST_FILTER_OPTIONS;

  useEffect(() => {
    if (!canView) return;
    let active = true;
    const request = dispatch(listMaterialRequest({ page, page_size: pageSize, search, filters, ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}) }));
    request.then((action) => {
      if (active && listMaterialRequest.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => { active = false; request.abort(); };
  }, [dispatch, canView, page, pageSize, search, filters, sorting, revision]);
  useEffect(() => {
    if (!canView) return;
    const request = dispatch(getMaterialRequestFilterOption());
    return () => request.abort();
  }, [dispatch, canView, revision]);
  useEffect(() => {
    if ([state.list.error, state.detail.error, state.options.error, state.catalog.error, state.mutation.error, state.filterOptions.error].some((error) => error?.status === 401)) router.replace("/login");
  }, [router, state.list.error, state.detail.error, state.options.error, state.catalog.error, state.mutation.error, state.filterOptions.error]);

  const query = state.list.query;
  const current = query?.page === page && query.page_size === pageSize && query.search === search && query.sort_by === sorting?.field && query.sort_order === sorting?.direction && JSON.stringify(query.filters) === JSON.stringify(filters);
  const data = current ? state.list.data : null;
  const error = current ? state.list.error : null;
  const loading = !current || state.list.loading || (!data && !error);
  const pending = state.mutation.loading;
  function changed() { setRevision((value) => value + 1); }
  function openPreview(id: string, action: "approve" | "reject" | "" = "") {
    dispatch(clearMaterialRequestMutation()); setReviewAction(action); setViewingId(id);
  }
  const actions: MaterialRequestActionProps = {
    disabled: loading || pending,
    onView: (row) => openPreview(row.id),
    onApprove: (row) => openPreview(row.id, "approve"),
    onReject: (row) => openPreview(row.id, "reject"),
    onTimeline: (row) => setTimelineId(row.id),
  };
  if (!access) return <Loading />;
  if (!canView) return <p className="p-6 text-sm text-muted-foreground">You do not have access to material requests.</p>;
  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Material requests</h1><p className="text-sm text-muted-foreground">Request materials from a linked supplying company.</p></div>
      {canPerform(access, "materialRequests", "add") && <Button disabled={pending} onClick={() => { dispatch(clearMaterialRequestMutation()); setCreating(true); }}>Create request</Button>}
    </div>
    <SearchFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }}
      filters={filters} onFiltersChange={(next) => { setFilters(next); setPage(1); }} fields={filterOptions.fields} statusOptions={filterOptions.statusOptions}
      filterLabels={{ date: "Creation date", status: "Request status" }} maxConditions={50}
      loading={loading} disabled={pending} searchLabel="Search material requests" placeholder="Search request number, hub or supplier" maxLength={160}
      quickFilterActive={activeFilters > 0} view={view} onViewChange={setView} viewLabel="Material request display" />
    {state.filterOptions.error && <p role="alert" className="text-sm text-destructive">{state.filterOptions.error.message} <Button variant="outline" onClick={() => dispatch(getMaterialRequestFilterOption())}>Try again</Button></p>}
    <div className="overflow-hidden rounded-lg border bg-white">
      {error ? <p role="alert" className="p-4">{error.message} <Button variant="outline" onClick={changed}>Try again</Button></p> : view === "table" ?
        <MaterialRequestsTableView {...actions} rows={data?.requests ?? []} loading={loading} sorting={sorting} onSortingChange={(next) => { setSorting(next); setPage(1); }} /> :
        loading ? <Loading /> : data?.requests.length ? <MaterialRequestsCards {...actions} rows={data.requests} /> : <p className="px-6 py-16 text-center text-sm text-muted-foreground">No material requests. Create a draft or adjust your search and filters.</p>}
    </div>
    {data && <Pagination metadata={paginationFromApi(data)} disabled={loading || pending} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} onPage={setPage}
      limitOptions={PAGE_SIZE_OPTIONS} onLimitChange={(size) => { setPageSize(size); setPage(1); }} />}
    {creating && <CreateMaterialRequestDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setPage(1); changed(); }} />}
    {editingId && <EditMaterialRequestDialog requestId={editingId} onClose={() => setEditingId(null)} onSaved={() => { setEditingId(null); changed(); }} />}
    {timelineId && <TimelineMaterialRequestDialog key={timelineId} requestId={timelineId} onClose={() => setTimelineId(null)} />}
    {viewingId && <ViewMaterialRequestDialog key={viewingId} requestId={viewingId} initialAction={reviewAction} onClose={() => setViewingId(null)} onChanged={changed} onEdit={() => { dispatch(clearMaterialRequestMutation()); setEditingId(viewingId); setViewingId(null); }} />}
  </div>;
}
