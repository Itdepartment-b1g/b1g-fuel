"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, PackageCheck, Plus } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar } from "@/components/common/search-filter-bar";
import { canPerform } from "@/lib/auth/access-scope";
import { countActiveFilters, createQuickFilterState } from "@/utils/quick-filter";
import { RECEIVING_FILTER_DEFAULTS } from "@/utils/management-filters";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import type { TableSort } from "@/types/table-views";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  clearReceivingMutation,
  deleteReceiving,
  getReceivingFilterOption,
  listReceiving,
  selectReceiving,
} from "@/lib/store/receiving-slice";
import type { ReceivingSummary } from "@/types/receiving";
import { ReceivingDialog } from "./dialog/receiving-dialog";
import { ReceivingCards } from "./card-views/receiving-cards";
import { ReceivingTableView } from "./table-view/receiving-table-view";

export default function ListReceiving() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const toast = useToast();
  const { receivings, total, listStatus, listError, mutationStatus, mutationError, filterOptions, filterOptionsError } =
    useAppSelector(selectReceiving);
  const [filters, setFilters] = useState(() => createQuickFilterState(RECEIVING_FILTER_DEFAULTS));
  const activeFilters = countActiveFilters(filters, RECEIVING_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useState<"table" | "cards">("table");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<ReceivingSummary | null>(null);
  const loading = listStatus === "idle" || listStatus === "loading";
  const pending = mutationStatus === "loading";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });

  useEffect(() => {
    let current = true;
    const request = dispatch(
      listReceiving({
        page,
        page_size: pageSize,
        search,
        ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}),
        ...(activeFilters ? { filters } : {}),
      }),
    );
    request.then((action) => {
      if (current && listReceiving.fulfilled.match(action)) {
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
    const request = dispatch(getReceivingFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);

  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [listError, mutationError, router]);

  if (listError?.status === 403) {
    return (
      <section className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to view receiving.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Procurement</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <PackageCheck className="size-7 text-primary" aria-hidden="true" />
            Receiving
          </h1>
        </div>
        {canPerform(access, "receiving", "add") && (
          <Button
            onClick={() => {
              dispatch(clearReceivingMutation());
              setEditor({ id: null });
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Receive order
          </Button>
        )}
      </div>
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
        filterLabels={{ date: "Creation date", status: "Status" }}
        loading={loading}
        placeholder="Search receiving no., supplier, warehouse, or notes"
        searchLabel="Search receipts"
        maxLength={160}
        quickFilterActive={Boolean(activeFilters)}
      />
      <div className="flex w-fit rounded-lg border p-1" role="group" aria-label="Receipt display">
        <button type="button" aria-label="Table view" aria-pressed={view === "table"} onClick={() => setView("table")} className={`inline-flex size-10 items-center justify-center rounded-md ${view === "table" ? "bg-gray-50" : "text-muted-foreground"}`}>
          <List className="size-4" />
        </button>
        <button type="button" aria-label="Card view" aria-pressed={view === "cards"} onClick={() => setView("cards")} className={`inline-flex size-10 items-center justify-center rounded-md ${view === "cards" ? "bg-gray-50" : "text-muted-foreground"}`}>
          <LayoutGrid className="size-4" />
        </button>
      </div>
      {filterOptionsError && <p role="alert" className="text-sm text-destructive">Filter choices could not be loaded.</p>}
      <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
        {view === "table" ? (
          <ReceivingTableView
            receivings={receivings}
            loading={loading}
            sorting={sorting}
            onSortingChange={(next) => {
              setSorting(next);
              setPage(1);
            }}
            onEdit={(row) => {
              dispatch(clearReceivingMutation());
              setEditor({ id: row.id });
            }}
            onDelete={setRemoving}
            disabled={pending}
          />
        ) : (
          <ReceivingCards
            receivings={receivings}
            disabled={pending}
            onEdit={(row) => {
              dispatch(clearReceivingMutation());
              setEditor({ id: row.id });
            }}
            onDelete={setRemoving}
          />
        )}
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
      {editor && (
        <ReceivingDialog
          receivingId={editor.id}
          onClose={() => setEditor(null)}
          onSaved={() => {
            if (!editor.id) setPage(1);
            setEditor(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
      <DeleteDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Delete receipt?"
        description="Delete this draft receipt? This cannot be undone."
        pending={pending}
        error={mutationError?.message}
        onConfirm={() => {
          if (!removing || pending) return;
          void (async () => {
            try {
              await dispatch(deleteReceiving(removing.id)).unwrap();
              toast.success("Receipt was deleted.");
              setRemoving(null);
              setRevision((value) => value + 1);
            } catch (error) {
              toast.error(toastErrorMessage(error, "Could not delete the receipt."));
            }
          })();
        }}
      />
    </div>
  );
}
