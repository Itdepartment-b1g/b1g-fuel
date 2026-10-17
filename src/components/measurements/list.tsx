"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Ruler } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import {
  useToast,
  toastErrorMessage,
} from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DeleteMeasurementDialog } from "./dialog/delete-measurement-dialog";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar } from "@/components/common/search-filter-bar";
import { canPerform } from "@/lib/auth/access-scope";
import { countActiveFilters, createQuickFilterState } from "@/utils/quick-filter";
import { MEASUREMENT_FILTER_DEFAULTS } from "@/utils/management-filters";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  paginationFromApi,
} from "@/utils/pagination";
import type { TableSort } from "@/types/table-views";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  clearMeasurementMutation,
  deleteMeasurement,
  getMeasurementFilterOption,
  listMeasurement,
  selectMeasurement,
} from "@/lib/store/measurements-slice";
import type { MeasurementSummary } from "@/types/measurements";
import { CreateMeasurementDialog } from "./dialog/create-measurement-dialog";
import { EditMeasurementDialog } from "./dialog/edit-measurement-dialog";
import { MeasurementsTableView } from "./table-view/measurements-table-view";
import { MeasurementsCards } from "./card-views/measurements-cards";

export default function MeasurementList() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const toast = useToast();
  const {
    measurements,
    total,
    listStatus,
    listError,
    mutationStatus,
    mutationError,
    filterOptions,
    filterOptionsError,
  } = useAppSelector(selectMeasurement);
  const [filters, setFilters] = useState(() =>
    createQuickFilterState(MEASUREMENT_FILTER_DEFAULTS),
  );
  const activeFilters = countActiveFilters(filters, MEASUREMENT_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useState<"table" | "cards">("table");
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MeasurementSummary | null>(null);
  const loading = listStatus === "idle" || listStatus === "loading";
  const pending = mutationStatus === "loading";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });
  useEffect(() => {
    let current = true;
    const request = dispatch(
      listMeasurement({
        page,
        page_size: pageSize,
        search,
        ...(sorting
          ? { sort_by: sorting.field, sort_order: sorting.direction }
          : {}),
        ...(activeFilters ? { filters } : {}),
      }),
    );
    request.then((action) => {
      if (current && listMeasurement.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => {
      current = false;
      request.abort();
    };
  }, [dispatch, page, pageSize, search, sorting, filters, activeFilters, revision]);
  useEffect(() => {
    const request = dispatch(getMeasurementFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);
  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [listError, mutationError, router]);
  function openEditor(measurement?: MeasurementSummary) {
    dispatch(clearMeasurementMutation());
    if (measurement) setEditingId(measurement.id);
    else setCreating(true);
  }
  function refresh() {
    setRevision((value) => value + 1);
  }
  async function remove() {
    if (!removing || pending) return;
    try {
      await dispatch(deleteMeasurement(removing.id)).unwrap();
      toast.success(`${removing.name} was deleted.`);
      setRemoving(null);
      refresh();
    } catch (error) {
      toast.error(
        toastErrorMessage(error, "Could not delete the measurement."),
      );
    }
  }
  if (listError?.status === 403)
    return (
      <section className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to view measurements.
        </p>
      </section>
    );
  const actions = {
    measurements,
    disabled: pending || loading,
    onEdit: openEditor,
    onDelete: (measurement: MeasurementSummary) => {
      dispatch(clearMeasurementMutation());
      setRemoving(measurement);
    },
  };
  return (
    <>
      <section className="w-full space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Procurement
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              Measurements
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Name the measurements and units available for your variants.
            </p>
          </div>
          {canPerform(access, "measurements", "add") && (
            <Button disabled={pending} onClick={() => openEditor()}>
              <Plus className="size-4" aria-hidden="true" /> Add measurement
            </Button>
          )}
        </header>
        <SearchFilterBar
            search={search}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            filters={filters}
            onFiltersChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
            fields={filterOptions.fields}
            statusOptions={filterOptions.statusOptions}
            additionalFilters={filterOptions.additionalFilters}
            filterLabels={{ date: "Creation date", status: "Ownership" }}
            maxConditions={50}
            loading={loading}
            searchLabel="Search measurements"
            placeholder="Search measurement name"
            maxLength={160}
            quickFilterActive={activeFilters > 0}
            view={view}
            onViewChange={setView}
            viewLabel="Measurement display"
          />
        <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
          {listError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 border-b bg-red-50 px-6 py-4 text-sm text-destructive"
            >
              <span>{listError.message}</span>
              <Button variant="outline" size="sm" onClick={refresh}>
                Try again
              </Button>
            </div>
          )}
          {filterOptionsError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 px-6 py-2 text-xs text-destructive"
            >
              <span>Filter choices could not be loaded.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch(getMeasurementFilterOption())}
              >
                Retry
              </Button>
            </div>
          )}
          <div
            aria-busy={loading}
            className={loading && measurements.length ? "opacity-60" : ""}
          >
            {view === "table" ? (
              <MeasurementsTableView
                {...actions}
                loading={loading}
                sorting={sorting}
                onSortingChange={(next) => {
                  setSorting(next);
                  setPage(1);
                }}
              />
            ) : !measurements.length && loading ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"
              >
                <LoaderCircle
                  className="size-5 animate-spin"
                  aria-hidden="true"
                />
                Loading measurements…
              </div>
            ) : measurements.length ? (
              <MeasurementsCards {...actions} />
            ) : !listError ? (
              <div className="px-6 py-16 text-center">
                <Ruler
                  className="mx-auto mb-4 size-10 text-primary/40"
                  aria-hidden="true"
                />
                <h3 className="font-semibold">
                  {search || activeFilters
                    ? "No matching measurements"
                    : "No measurements yet"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {search || activeFilters
                    ? "Try another search or clear your filters."
                    : "Add a measurement or adjust your search."}
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <Pagination
          metadata={pagination}
          disabled={loading || pending}
          onPrev={() => setPage(pagination.page - 1)}
          onNext={() => setPage(pagination.page + 1)}
          onPage={setPage}
          onLimitChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          limitOptions={PAGE_SIZE_OPTIONS}
        />
      </section>
      {creating && (
        <CreateMeasurementDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setPage(1);
            setCreating(false);
            refresh();
          }}
        />
      )}
      {editingId && (
        <EditMeasurementDialog
          measurementId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            refresh();
          }}
        />
      )}
      {removing && (
        <DeleteMeasurementDialog
          measurement={removing}
          pending={pending}
          error={mutationError?.message}
          onClose={() => setRemoving(null)}
          onConfirm={() => { void remove(); }}
        />
      )}
    </>
  );
}
