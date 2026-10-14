"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  List,
  LoaderCircle,
  Plus,
  Ruler,
  Search,
} from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import {
  useToast,
  toastErrorMessage,
} from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/common/pagination";
import { canPerform } from "@/lib/auth/access-scope";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  paginationFromApi,
} from "@/utils/pagination";
import type { TableSort } from "@/types/table-views";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  archiveMeasurement,
  clearMeasurementMutation,
  listMeasurement,
  selectMeasurement,
  updateMeasurement,
} from "@/lib/store/measurements-slice";
import type { MeasurementSummary } from "@/types/measurements";
import { MeasurementDialog } from "./dialog/measurement-dialog";
import { ArchiveMeasurementDialog } from "./dialog/archive-measurement-dialog";
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
  } = useAppSelector(selectMeasurement);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("active");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useState<"table" | "cards">("table");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [archiving, setArchiving] = useState<MeasurementSummary | null>(null);
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
        ...(status === "all" ? {} : { is_active: status === "active" }),
        ...(sorting
          ? { sort_by: sorting.field, sort_order: sorting.direction }
          : {}),
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
  }, [dispatch, page, pageSize, search, status, sorting, revision]);
  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [listError, mutationError, router]);
  function openEditor(measurement?: MeasurementSummary) {
    dispatch(clearMeasurementMutation());
    setEditor({ id: measurement?.id ?? null });
  }
  function refresh() {
    setRevision((value) => value + 1);
  }
  async function archive() {
    if (!archiving || pending) return;
    try {
      await dispatch(archiveMeasurement(archiving.id)).unwrap();
      toast.success(`${archiving.name} was archived.`);
      setArchiving(null);
      refresh();
    } catch (error) {
      toast.error(
        toastErrorMessage(error, "Could not archive the measurement."),
      );
    }
  }
  async function restore(measurement: MeasurementSummary) {
    if (pending) return;
    dispatch(clearMeasurementMutation());
    try {
      await dispatch(
        updateMeasurement({ id: measurement.id, is_active: true }),
      ).unwrap();
      toast.success(`${measurement.name} was restored.`);
      refresh();
    } catch (error) {
      toast.error(
        toastErrorMessage(error, "Could not restore the measurement."),
      );
    }
  }
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draft.trim());
    setPage(1);
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
    onArchive: (measurement: MeasurementSummary) => {
      dispatch(clearMeasurementMutation());
      setArchiving(measurement);
    },
    onRestore: (measurement: MeasurementSummary) => {
      void restore(measurement);
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
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={submitSearch} className="flex min-w-60 flex-1 gap-2">
            <Input
              aria-label="Search measurements"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search measurement name"
              maxLength={160}
            />
            <Button type="submit" variant="outline" aria-label="Search">
              <Search className="size-4" />
            </Button>
            {(search || draft) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft("");
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </form>
          <label className="flex items-center gap-2 text-sm">
            Status
            <select
              className="h-10 rounded-md border bg-white px-3"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </label>
          <div
            className="flex rounded-lg border p-1"
            role="group"
            aria-label="Measurement display"
          >
            <button
              type="button"
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className={`inline-flex size-9 items-center justify-center rounded-md ${view === "table" ? "bg-gray-50" : "text-muted-foreground"}`}
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Card view"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
              className={`inline-flex size-9 items-center justify-center rounded-md ${view === "cards" ? "bg-gray-50" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
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
                <h3 className="font-semibold">No measurements found</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a measurement or adjust your search and status filter.
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
      {editor && (
        <MeasurementDialog
          measurementId={editor.id}
          onClose={() => setEditor(null)}
          onSaved={() => {
            if (!editor.id) setPage(1);
            setEditor(null);
            refresh();
          }}
        />
      )}
      {archiving && (
        <ArchiveMeasurementDialog
          name={archiving.name}
          pending={pending}
          error={mutationError?.message ?? null}
          onClose={() => setArchiving(null)}
          onConfirm={() => {
            void archive();
          }}
        />
      )}
    </>
  );
}
