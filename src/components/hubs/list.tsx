"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/common/loading";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar, useListView } from "@/components/common/filter/search-filter-bar";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearHubMutation, deactivateHub, getHubFilterOption, listHub, selectHub } from "@/lib/store/hubs-slice";
import { countActiveFilters, createQuickFilterState } from "@/utils/quick-filter";
import { HUB_FILTER_DEFAULTS } from "@/utils/hubs-filters";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import type { HubSummary } from "@/types/hubs";
import type { TableSort } from "@/types/table-views";
import { CreateHubDialog } from "./dialog/create-hub-dialog";
import { EditHubDialog } from "./dialog/edit-hub-dialog";
import { DeactivateHubDialog } from "./dialog/deactivate-hub-dialog";
import { AssignHubDialog } from "./dialog/assign-hub-dialog";
import { HubsTableView } from "./table-view/hubs-table-view";
import { HubsCards } from "./card-views/hubs-cards";

export default function HubsList() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const toast = useToast();
  const { hubs, total, listStatus, listError, mutationStatus, mutationError, filterOptions, filterOptionsError } = useAppSelector(selectHub);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() => createQuickFilterState(HUB_FILTER_DEFAULTS));
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useListView();
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<HubSummary | null>(null);
  const [assigning, setAssigning] = useState<HubSummary | null>(null);
  const activeFilters = countActiveFilters(filters, HUB_FILTER_DEFAULTS);
  const canView = canPerform(access, "hubs", "view");
  const loading = listStatus === "idle" || listStatus === "loading";
  const pending = mutationStatus === "loading";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });

  useEffect(() => {
    if (!canView) return;
    let current = true;
    const request = dispatch(listHub({
      page, page_size: pageSize, search,
      ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}),
      ...(activeFilters ? { filters } : {}),
    }));
    request.then((action) => {
      if (current && listHub.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => { current = false; request.abort(); };
  }, [dispatch, canView, page, pageSize, search, sorting, filters, activeFilters, revision]);
  useEffect(() => {
    if (!canView) return;
    const request = dispatch(getHubFilterOption());
    return () => request.abort();
  }, [dispatch, canView, revision]);
  useEffect(() => {
    if ([listError, mutationError, filterOptionsError].some((error) => error?.status === 401)) router.replace("/login");
  }, [listError, mutationError, filterOptionsError, router]);

  function refresh() { setRevision((value) => value + 1); }
  function openHub(hub?: HubSummary) {
    dispatch(clearHubMutation());
    if (hub) setEditingId(hub.id);
    else setCreating(true);
  }
  async function deactivate() {
    if (!deactivating || pending) return;
    try {
      await dispatch(deactivateHub(deactivating.id)).unwrap();
      toast.success(`${deactivating.name} was deactivated.`);
      setDeactivating(null);
      refresh();
    } catch (error) { toast.error(toastErrorMessage(error, "Could not deactivate the hub.")); }
  }
  const actions = {
    hubs, loading, disabled: pending || loading, sorting, revision,
    onSortingChange: (next: TableSort | null) => { setSorting(next); setPage(1); },
    onEdit: (hub: HubSummary) => openHub(hub),
    onDeactivate: (hub: HubSummary) => { dispatch(clearHubMutation()); setDeactivating(hub); },
    onAssign: (hub: HubSummary) => { dispatch(clearHubMutation()); setAssigning(hub); },
  };
  if (!access) return <Loading />;
  if (!canView) return <section className="rounded-lg border bg-white p-6"><h1 className="text-2xl font-bold">Hubs</h1><p role="status" className="mt-2 text-sm text-muted-foreground">You do not have permission to view hubs. Ask your supervisor to check your access.</p></section>;
  return (
    <>
      <section className="w-full space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight text-primary">Hubs</h1><p className="mt-2 text-sm text-muted-foreground">Manage your company&apos;s hubs and staff assignments.</p></div>
          {canPerform(access, "hubs", "add") && <Button className="w-full lg:w-auto" disabled={pending} onClick={() => openHub()}><Plus className="size-4" aria-hidden="true" />Create hub</Button>}
        </header>
        <SearchFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }}
          filters={filters} onFiltersChange={(next) => { setFilters(next); setPage(1); }}
          fields={filterOptions.fields} statusOptions={filterOptions.statusOptions} additionalFilters={filterOptions.additionalFilters}
          filterLabels={{ date: "Creation date", status: "Hub status" }} maxConditions={50}
          loading={loading} disabled={pending} searchLabel="Search hubs" placeholder="Search hub name or address" maxLength={160}
          quickFilterActive={activeFilters > 0} view={view} onViewChange={setView} viewLabel="Hub display" />
        <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
          {listError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b bg-red-50 px-6 py-4 text-sm text-destructive">
            <span>{listError.message}</span><Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
          </div>}
          {filterOptionsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-3 text-sm text-destructive">
            <span>Filter choices could not be loaded.</span><Button variant="ghost" size="sm" onClick={() => dispatch(getHubFilterOption())}>Try again</Button>
          </div>}
          <div aria-busy={loading} className={loading && hubs.length ? "opacity-60" : ""}>
            {view === "table" ? <HubsTableView {...actions} /> : !hubs.length && loading ? <div className="py-16"><Loading /></div> : hubs.length ? <HubsCards {...actions} /> : !listError ? (
              <div className="px-6 py-16 text-center"><Building2 className="mx-auto mb-4 size-10 text-primary/40" aria-hidden="true" />
                <h2 className="font-semibold">{search || activeFilters ? "No matching hubs" : "No hubs yet"}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{search || activeFilters ? "Try another search or clear your filters." : canPerform(access, "hubs", "add") ? "Create your first hub to get started." : "Your company hubs will appear here when available to you."}</p>
              </div>
            ) : null}
          </div>
        </div>
        <Pagination metadata={pagination} disabled={loading || pending} onPrev={() => setPage(pagination.page - 1)} onNext={() => setPage(pagination.page + 1)}
          onPage={setPage} onLimitChange={(size) => { setPageSize(size); setPage(1); }} limitOptions={PAGE_SIZE_OPTIONS} />
      </section>
      {creating && <CreateHubDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setPage(1); refresh(); }} />}
      {editingId && <EditHubDialog hubId={editingId} onClose={() => setEditingId(null)} onSaved={() => { setEditingId(null); refresh(); }} />}
      {deactivating && <DeactivateHubDialog hub={deactivating} pending={pending} error={mutationError?.message} onClose={() => setDeactivating(null)} onConfirm={() => { void deactivate(); }} />}
      {assigning && <AssignHubDialog key={assigning.id} hub={hubs.find((hub) => hub.id === assigning.id) ?? assigning} onClose={() => setAssigning(null)} onChanged={refresh} />}
    </>
  );
}
