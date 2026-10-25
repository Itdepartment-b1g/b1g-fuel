"use client";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { getMaterialRequestCatalog } from "@/lib/store/material-requests-slice";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/pagination";
import { paginationFromApi } from "@/utils/pagination";
export type SelectedMaterial = {
  product_id: string;
  label: string;
  unit_label: string;
  requested_qty: string;
};

export function RequestProductPicker({
  hubId,
  supplierId,
  items,
  onChange,
  disabled,
}: {
  hubId: string;
  supplierId: string;
  items: SelectedMaterial[];
  onChange: (items: SelectedMaterial[]) => void;
  disabled: boolean;
}) {
  const dispatch = useAppDispatch();
  const state = useAppSelector((state) => state.materialRequests.catalog);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const request = dispatch(
      getMaterialRequestCatalog({
        hub_id: hubId,
        supplier_id: supplierId,
        page,
        page_size: 10,
        search,
      }),
    );
    return () => request.abort();
  }, [dispatch, hubId, supplierId, page, search, revision]);
  const current =
    state.query?.hub_id === hubId &&
    state.query.supplier_id === supplierId &&
    state.query.page === page &&
    state.query.search === search;
  const data = current ? state.data : null;
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">Supplier products</h3>
      <div className="flex gap-2">
        <Input
          aria-label="Search supplier products"
          placeholder="Search brand or variant"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={160}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          Search
        </Button>
      </div>
      {current && state.error ? (
        <p role="alert">
          {state.error.message}{" "}
          <Button
            type="button"
            variant="outline"
            onClick={() => setRevision((value) => value + 1)}
          >
            Try again
          </Button>
        </p>
      ) : !data ? (
        <p role="status">Loading products...</p>
      ) : (
        <>
          <ul className="space-y-2">
            {data.products.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  {product.label}{" "}
                  <span className="text-muted-foreground">
                    ({product.unit_label})
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    disabled ||
                    items.some((item) => item.product_id === product.id) ||
                    items.length >= 100
                  }
                  onClick={() =>
                    onChange([
                      ...items,
                      {
                        product_id: product.id,
                        label: product.label,
                        unit_label: product.unit_label,
                        requested_qty: "1",
                      },
                    ])
                  }
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
          {!data.products.length && (
            <p className="text-sm text-muted-foreground">
              No matching products.
            </p>
          )}
          {data.total > 10 && (
            <Pagination
              metadata={paginationFromApi(data)}
              disabled={disabled}
              onPrev={() => setPage(page - 1)}
              onNext={() => setPage(page + 1)}
              onPage={setPage}
            />
          )}
        </>
      )}
      <h3 className="border-t pt-3 font-medium">
        Selected materials ({items.length})
      </h3>
      {!items.length && (
        <p className="text-sm text-muted-foreground">
          Add at least one product.
        </p>
      )}
      {items.map((item) => (
        <div
          key={item.product_id}
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <span className="min-w-0 flex-1">{item.label}</span>
          <Input
            className="w-28"
            aria-label={`Quantity for ${item.label}`}
            type="number"
            min="0.001"
            max="99999999999.999"
            step="0.001"
            value={item.requested_qty}
            required
            disabled={disabled}
            onChange={(event) =>
              onChange(
                items.map((row) =>
                  row.product_id === item.product_id
                    ? { ...row, requested_qty: event.target.value }
                    : row,
                ),
              )
            }
          />
          <span>{item.unit_label}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              onChange(
                items.filter((row) => row.product_id !== item.product_id),
              )
            }
          >
            Remove
          </Button>
        </div>
      ))}
    </section>
  );
}
