"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRecordAccess } from "@/components/providers/access-provider";
import { Button } from "@/components/ui/button";
import { canPerform } from "@/lib/auth/access-scope";
import type { BrandSummary } from "@/types/brands";
import type { VariantSummary, VariantsPage } from "@/types/variants";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function BrandVariants({
  brand,
  revision,
  onAdd,
  onEdit,
  onDelete,
}: {
  brand: BrandSummary;
  revision: number;
  onAdd: (brand: BrandSummary) => void;
  onEdit: (variant: VariantSummary) => void;
  onDelete: (variant: VariantSummary) => void;
}) {
  const access = useRecordAccess();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<VariantsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canAdd = canPerform(access, "brandsAndVariants", "add");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          brand_id: brand.id,
          page: String(page),
          page_size: "10",
        });
        const response = await fetch(`/api/variants?${params}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (response.status === 401) router.replace("/login");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load variants.");
        if (!controller.signal.aborted) setResult(data);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Could not load variants.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [brand.id, page, revision, retry, router]);

  return (
    <section aria-label={`Variants for ${brand.name}`} aria-busy={loading} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Variants</h3>
        {canAdd && (
          <Button type="button" size="sm" variant="outline" onClick={() => onAdd(brand)}>
            <Plus className="size-4" aria-hidden="true" /> Add variant
          </Button>
        )}
      </div>
      {loading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading variants…
        </p>
      ) : error ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>
            Retry
          </Button>
        </div>
      ) : result ? (
        <>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Variants for {brand.name}</caption>
              <thead className="border-b bg-gray-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Variant</th>
                  <th scope="col" className="px-4 py-3">Company</th>
                  <th scope="col" className="px-4 py-3">Created</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.variants.length ? result.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="px-4 py-3 font-medium">{variant.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{variant.company?.name ?? "All companies"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      <time dateTime={variant.created_at}>{formatDate(variant.created_at)}</time>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canPerform(access, "brandsAndVariants", "edit", variant)}
                          onClick={() => onEdit(variant)}
                        >
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canPerform(access, "brandsAndVariants", "delete", variant)}
                          onClick={() => onDelete(variant)}
                        >
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No variants yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {result.total > result.page_size && (
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {Math.ceil(result.total / result.page_size)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * result.page_size >= result.total}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
