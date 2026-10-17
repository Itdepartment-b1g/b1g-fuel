"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shapes } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar } from "@/components/common/search-filter-bar";
import { canPerform } from "@/lib/auth/access-scope";
import {
  countActiveFilters,
  createQuickFilterState,
} from "@/utils/quick-filter";
import { PRODUCT_TYPE_FILTER_DEFAULTS } from "@/utils/management-filters";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  paginationFromApi,
} from "@/utils/pagination";
import type { TableSort } from "@/types/table-views";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  clearProductTypeMutation,
  deleteProductType,
  getProductTypeFilterOption,
  listProductType,
  selectProductType,
} from "@/lib/store/product-types-slice";
import type { ProductTypeSummary } from "@/types/product-types";
import { CreateProductTypeDialog } from "./dialog/create-product-type-dialog";
import { EditProductTypeDialog } from "./dialog/edit-product-type-dialog";
import { ProductTypesTableView } from "./table-view/product-types-table-view";

export default function ListProductTypes() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const toast = useToast();
  const {
    product_types,
    total,
    listStatus,
    listError,
    mutationStatus,
    mutationError,
    filterOptions,
    filterOptionsError,
  } = useAppSelector(selectProductType);
  const [filters, setFilters] = useState(() =>
    createQuickFilterState(PRODUCT_TYPE_FILTER_DEFAULTS),
  );
  const activeFilters = countActiveFilters(filters, PRODUCT_TYPE_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ProductTypeSummary | null>(null);
  const loading = listStatus === "idle" || listStatus === "loading";
  const pending = mutationStatus === "loading";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });

  useEffect(() => {
    let current = true;
    const request = dispatch(
      listProductType({
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
      if (current && listProductType.fulfilled.match(action)) {
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
    const request = dispatch(getProductTypeFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);

  useEffect(() => {
    if ([listError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [listError, mutationError, router]);

  if (listError?.status === 403) {
    return (
      <section className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to view product types.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Procurement</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Shapes className="size-7 text-primary" aria-hidden="true" />
            Product types
          </h1>
        </div>
        {canPerform(access, "productTypes", "add") && (
          <Button
            onClick={() => {
              dispatch(clearProductTypeMutation());
              setCreating(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add product type
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
        filterLabels={{ date: "Creation date", status: "Ownership" }}
        loading={loading}
        placeholder="Search name or key"
        searchLabel="Search product types"
        maxLength={160}
        quickFilterActive={Boolean(activeFilters)}
      />
      {filterOptionsError && (
        <p role="alert" className="text-sm text-destructive">
          Filter choices could not be loaded.
        </p>
      )}
      <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
        <ProductTypesTableView
          productTypes={product_types}
          loading={loading}
          sorting={sorting}
          onSortingChange={(next) => {
            setSorting(next);
            setPage(1);
          }}
          onEdit={(row) => {
            dispatch(clearProductTypeMutation());
            setEditingId(row.id);
          }}
          onDelete={setRemoving}
          disabled={pending}
        />
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
      {creating && (
        <CreateProductTypeDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setPage(1);
            setCreating(false);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {editingId && (
        <EditProductTypeDialog
          productTypeId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
      <DeleteDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Delete product type?"
        description={`Delete ${removing?.name ?? "this product type"}? Types used by products cannot be deleted.`}
        pending={pending}
        error={mutationError?.message}
        onConfirm={() => {
          if (!removing || pending) return;
          void (async () => {
            try {
              await dispatch(deleteProductType(removing.id)).unwrap();
              toast.success(`${removing.name} was deleted.`);
              setRemoving(null);
              setRevision((value) => value + 1);
            } catch (error) {
              toast.error(
                toastErrorMessage(error, "Could not delete the product type."),
              );
            }
          })();
        }}
      />
    </div>
  );
}
