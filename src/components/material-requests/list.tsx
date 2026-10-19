"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/common/pagination";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearMaterialRequestMutation, listMaterialRequest } from "@/lib/store/material-requests-slice";
import { canPerform } from "@/lib/auth/access-scope";
import { useRecordAccess } from "@/components/providers/access-provider";
import { paginationFromApi } from "@/utils/pagination";
import { MaterialRequestsTableView } from "./table-view/material-requests-table-view";
import { CreateMaterialRequestDialog } from "./dialog/create-material-request-dialog";
import { EditMaterialRequestDialog } from "./dialog/edit-material-request-dialog";
import { ViewMaterialRequestDialog } from "./dialog/view-material-request-dialog";

export default function MaterialRequestsList() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const state = useAppSelector((state) => state.materialRequests);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canView = canPerform(access, "materialRequests", "view");
  useEffect(() => {
    if (!canView) return;
    let active = true;
    const request = dispatch(listMaterialRequest({ page, page_size: 10, search, status }));
    request.then((action) => { if (active && listMaterialRequest.fulfilled.match(action)) { const valid = paginationFromApi(action.payload).page; if (valid !== page) setPage(valid); } });
    return () => { active = false; request.abort(); };
  }, [dispatch, canView, page, search, status, revision]);
  useEffect(() => {
    if ([state.list.error, state.detail.error, state.options.error, state.catalog.error, state.mutation.error].some((error) => error?.status === 401)) router.replace("/login");
  }, [router, state.list.error, state.detail.error, state.options.error, state.catalog.error, state.mutation.error]);
  const current = state.list.query?.page === page && state.list.query.search === search && state.list.query.status === status;
  const data = current ? state.list.data : null;
  function changed() { setRevision((value) => value + 1); }
  if (!canView) return <p className="p-6 text-sm text-muted-foreground">You do not have access to material requests.</p>;
  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Material requests</h1><p className="text-sm text-muted-foreground">Request materials from a linked supplying company.</p></div>
      {canPerform(access, "materialRequests", "add") && <Button onClick={() => { dispatch(clearMaterialRequestMutation()); setCreating(true); }}>Create request</Button>}</div>
    <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-4"><form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setSearch(draft.trim()); setPage(1); }}><Input aria-label="Search material requests" placeholder="Search request number or hub" value={draft} maxLength={160} onChange={(event) => setDraft(event.target.value)} /><Button variant="outline">Search</Button>{search && <Button type="button" variant="ghost" onClick={() => { setDraft(""); setSearch(""); setPage(1); }}>Clear</Button>}</form>
      <label className="flex items-center gap-2 text-sm">Status<select className="h-10 rounded-md border px-3" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All</option>{["draft", "submitted", "approved", "rejected", "cancelled"].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></div>
    {current && state.list.error ? <p role="alert">{state.list.error.message} <Button variant="outline" onClick={changed}>Try again</Button></p> : <MaterialRequestsTableView rows={data?.requests ?? []} loading={!data || state.list.loading} onView={(row) => { dispatch(clearMaterialRequestMutation()); setViewingId(row.id); }} />}
    {data && data.total > 0 && <Pagination metadata={paginationFromApi(data)} disabled={state.list.loading} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} onPage={setPage} />}
    {creating && <CreateMaterialRequestDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setPage(1); changed(); }} />}
    {editingId && <EditMaterialRequestDialog requestId={editingId} onClose={() => setEditingId(null)} onSaved={() => { setEditingId(null); changed(); }} />}
    {viewingId && <ViewMaterialRequestDialog requestId={viewingId} onClose={() => setViewingId(null)} onChanged={changed} onEdit={() => { dispatch(clearMaterialRequestMutation()); setEditingId(viewingId); setViewingId(null); }} />}
  </div>;
}
