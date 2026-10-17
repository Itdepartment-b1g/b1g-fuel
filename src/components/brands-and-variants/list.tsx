"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, LoaderCircle, Plus, Tag } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Pagination } from "@/components/common/pagination";
import { SearchFilterBar } from "@/components/common/search-filter-bar";
import { canPerform } from "@/lib/auth/access-scope";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  clearBrandMutation,
  deleteBrand,
  getBrandFilterOption,
  listBrand,
  selectBrand,
} from "@/lib/store/brands-slice";
import { clearVariantMutation, deleteVariant, selectVariant } from "@/lib/store/variants-slice";
import { countActiveFilters, createQuickFilterState } from "@/utils/quick-filter";
import { BRAND_FILTER_DEFAULTS } from "@/utils/management-filters";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationFromApi } from "@/utils/pagination";
import type { TableSort } from "@/types/table-views";
import type { BrandSummary } from "@/types/brands";
import type { VariantSummary } from "@/types/variants";
import { CreateBrandDialog } from "./dialog/create-brand-dialog";
import { EditBrandDialog } from "./dialog/edit-brand-dialog";
import { CreateVariantDialog } from "./dialog/create-variant-dialog";
import { EditVariantDialog } from "./dialog/edit-variant-dialog";
import { BrandsTableView } from "./table-view/brands-table-view";
import { BrandsCards } from "./card-views/brands-cards";

type Removal =
  | { kind: "brand"; record: BrandSummary }
  | { kind: "variant"; record: VariantSummary };

export default function BrandAndVariantList() {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const router = useRouter();
  const {
    brands,
    total,
    listStatus,
    listError,
    mutationStatus,
    mutationError,
    filterOptions,
    filterOptionsError,
  } = useAppSelector(selectBrand);
  const { mutationStatus: variantMutationStatus, mutationError: variantMutationError } =
    useAppSelector(selectVariant);
  const [filters, setFilters] = useState(() => createQuickFilterState(BRAND_FILTER_DEFAULTS));
  const activeFilters = countActiveFilters(filters, BRAND_FILTER_DEFAULTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useState<"table" | "cards">("table");
  const [revision, setRevision] = useState(0);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [creatingVariant, setCreatingVariant] = useState<{ brandId?: string } | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Removal | null>(null);
  const loading = listStatus === "idle" || listStatus === "loading";
  const pending = mutationStatus === "loading" || variantMutationStatus === "loading";
  const pagination = paginationFromApi({ page, page_size: pageSize, total });

  useEffect(() => {
    let current = true;
    const request = dispatch(
      listBrand({
        page,
        page_size: pageSize,
        search,
        ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}),
        ...(activeFilters ? { filters } : {}),
      }),
    );
    request.then((action) => {
      if (current && listBrand.fulfilled.match(action)) {
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
    const request = dispatch(getBrandFilterOption());
    return () => request.abort();
  }, [dispatch, revision]);
  useEffect(() => {
    if ([listError, mutationError, variantMutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [listError, mutationError, variantMutationError, router]);

  function refresh() {
    setRevision((value) => value + 1);
  }
  function openBrand(brand?: BrandSummary) {
    dispatch(clearBrandMutation());
    if (brand) setEditingBrandId(brand.id);
    else setCreatingBrand(true);
  }
  function openVariant(brand?: BrandSummary, variant?: VariantSummary) {
    dispatch(clearVariantMutation());
    if (variant) setEditingVariantId(variant.id);
    else setCreatingVariant({ brandId: brand?.id });
  }
  async function remove() {
    if (!removing || pending) return;
    try {
      if (removing.kind === "brand") {
        await dispatch(deleteBrand(removing.record.id)).unwrap();
        toast.success(`${removing.record.name} was deleted.`);
      } else {
        await dispatch(deleteVariant(removing.record.id)).unwrap();
        toast.success(`${removing.record.name} was deleted.`);
      }
      setRemoving(null);
      refresh();
    } catch (error) {
      toast.error(
        toastErrorMessage(
          error,
          removing.kind === "brand" ? "Could not delete the brand." : "Could not delete the variant.",
        ),
      );
    }
  }

  if (listError?.status === 403)
    return (
      <section className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to view brands and variants.</p>
      </section>
    );

  const actions = {
    brands,
    sorting,
    loading,
    revision,
    disabled: pending || loading,
    onSortingChange: (next: TableSort | null) => {
      setSorting(next);
      setPage(1);
    },
    onEdit: openBrand,
    onDelete: (brand: BrandSummary) => {
      dispatch(clearBrandMutation());
      setRemoving({ kind: "brand", record: brand });
    },
    onAddVariant: (brand: BrandSummary) => openVariant(brand),
    onEditVariant: (variant: VariantSummary) => openVariant(undefined, variant),
    onDeleteVariant: (variant: VariantSummary) => {
      dispatch(clearVariantMutation());
      setRemoving({ kind: "variant", record: variant });
    },
  };
  const deleteError = removing?.kind === "variant" ? variantMutationError : mutationError;

  return (
    <>
      <section className="w-full space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Procurement
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Brands & Variants</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep the brands your company buys, and the variants under each brand.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canPerform(access, "brandsAndVariants", "add") && (
              <>
                <Button variant="outline" disabled={pending} onClick={() => openVariant()}>
                  <Plus className="size-4" aria-hidden="true" /> Add variant
                </Button>
                <Button disabled={pending} onClick={() => openBrand()}>
                  <Plus className="size-4" aria-hidden="true" /> Add brand
                </Button>
              </>
            )}
          </div>
        </header>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchFilterBar
            className="min-w-0 w-full flex-1"
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
            filterLabels={{ date: "Creation date", status: "Variants" }}
            maxConditions={50}
            loading={loading}
            searchLabel="Search brands"
            placeholder="Search brand name"
            maxLength={160}
            quickFilterActive={activeFilters > 0}
          />
          <div
            className="flex w-fit shrink-0 self-end rounded-lg border p-1 sm:self-auto"
            role="group"
            aria-label="Brand display"
          >
            <button
              type="button"
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className={`inline-flex size-10 items-center justify-center rounded-md ${view === "table" ? "bg-gray-50" : "text-muted-foreground"}`}
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Card view"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
              className={`inline-flex size-10 items-center justify-center rounded-md ${view === "cards" ? "bg-gray-50" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-[6px] border bg-white shadow-sm">
          {listError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 border-b bg-red-50 px-6 py-4 text-sm text-destructive"
            >
              <span>{listError.message}</span>
              <Button variant="outline" size="sm" onClick={refresh}>
                Try again
              </Button>
            </div>
          )}
          {filterOptionsError && (
            <div role="alert" className="flex items-center justify-between gap-2 px-6 py-2 text-xs text-destructive">
              <span>Filter choices could not be loaded.</span>
              <Button variant="ghost" size="sm" onClick={() => dispatch(getBrandFilterOption())}>
                Retry
              </Button>
            </div>
          )}
          <div aria-busy={loading} className={loading && brands.length ? "opacity-60" : ""}>
            {view === "table" ? (
              <BrandsTableView {...actions} />
            ) : !brands.length && loading ? (
              <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                Loading brands…
              </div>
            ) : brands.length ? (
              <BrandsCards {...actions} />
            ) : !listError ? (
              <div className="px-6 py-16 text-center">
                <Tag className="mx-auto mb-4 size-10 text-primary/40" aria-hidden="true" />
                <h3 className="font-semibold">
                  {search || activeFilters ? "No matching brands" : "No brands yet"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {search || activeFilters
                    ? "Try another search or clear your filters."
                    : "Add a brand, then add the variants under it."}
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
      {creatingBrand && (
        <CreateBrandDialog
          onClose={() => setCreatingBrand(false)}
          onSaved={() => {
            setPage(1);
            setCreatingBrand(false);
            refresh();
          }}
        />
      )}
      {editingBrandId && (
        <EditBrandDialog
          brandId={editingBrandId}
          onClose={() => setEditingBrandId(null)}
          onSaved={() => {
            setEditingBrandId(null);
            refresh();
          }}
        />
      )}
      {creatingVariant && (
        <CreateVariantDialog
          brandId={creatingVariant.brandId}
          onClose={() => setCreatingVariant(null)}
          onSaved={() => {
            setCreatingVariant(null);
            refresh();
          }}
        />
      )}
      {editingVariantId && (
        <EditVariantDialog
          variantId={editingVariantId}
          onClose={() => setEditingVariantId(null)}
          onSaved={() => {
            setEditingVariantId(null);
            refresh();
          }}
        />
      )}
      <DeleteDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={removing?.kind === "variant" ? "Delete variant?" : "Delete brand?"}
        description={
          removing?.kind === "variant"
            ? `Delete ${removing.record.name}? This cannot be undone.`
            : `Delete ${removing?.record.name ?? "this brand"}? A brand that still has variants cannot be deleted.`
        }
        onConfirm={() => {
          void remove();
        }}
        pending={pending}
        error={deleteError?.message}
      />
    </>
  );
}
