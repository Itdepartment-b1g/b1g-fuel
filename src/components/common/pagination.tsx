"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_LIMIT_OPTIONS, mobilePageNumbers, pageNavigation, validateLimit } from "@/utils/pagination";
import type { PaginationMetadata } from "@/types/pagination";

export type PaginationProps = {
  metadata: PaginationMetadata;
  onPrev: () => void;
  onNext: () => void;
  onPage?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: readonly number[];
  disabled?: boolean;
  className?: string;
};

export function Pagination({
  metadata,
  onPrev,
  onNext,
  onPage,
  onLimitChange,
  limitOptions = DEFAULT_LIMIT_OPTIONS,
  disabled = false,
  className,
}: PaginationProps) {
  const { page, limit, total_pages, has_next_page, has_prev_page } = metadata;
  const options = [...new Set(limitOptions)];
  options.forEach(validateLimit);
  const canPrev = !disabled && has_prev_page && page > 1 && total_pages > 0;
  const canNext = !disabled && has_next_page && page < total_pages;
  function goTo(target: number) {
    const action = pageNavigation(target, metadata, Boolean(onPage), disabled);
    if (action === "page") onPage?.(target);
    else if (action === "prev") onPrev();
    else if (action === "next") onNext();
  }
  return (
    <div className={cn("px-1 py-4", className)}>
      <div className="hidden items-center justify-between gap-4 sm:flex">
        {onLimitChange && (
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            Rows per page
            <select
              aria-label="Rows per page"
              value={limit}
              disabled={disabled}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!disabled && options.includes(next) && next !== limit)
                  onLimitChange(next);
              }}
              className="h-9 rounded-md border bg-white px-2 text-foreground focus-visible:outline-primary"
            >
              {options.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto flex items-center gap-4 text-sm text-slate-500">
          <button
            type="button"
            aria-label="Previous page"
            disabled={!canPrev}
            onClick={() => {
              if (canPrev) onPrev();
            }}
            className="disabled:opacity-40"
          >
            Previous
          </button>
          <span className="whitespace-nowrap">
            Page {page} of {total_pages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={!canNext}
            onClick={() => {
              if (canNext) onNext();
            }}
            className="disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
      <nav
        aria-label="Pagination"
        className="flex items-center justify-center gap-0.5 sm:hidden"
      >
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={!canPrev}
          onClick={() => {
            if (canPrev) onPrev();
          }}
          className="size-8 shrink-0"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        {mobilePageNumbers(page, total_pages).map((number, index) =>
          number === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="flex h-8 w-3.5 shrink-0 items-center justify-center text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={number}
              type="button"
              variant={number === page ? "default" : "outline"}
              size="icon"
              aria-label={`Page ${number}`}
              aria-current={number === page ? "page" : undefined}
              disabled={
                disabled ||
                (number !== page &&
                  !onPage &&
                  !(
                    (number === page - 1 && canPrev) ||
                    (number === page + 1 && canNext)
                  ))
              }
              onClick={() => goTo(number)}
              className="h-8 w-[30px] min-w-[30px] shrink-0 px-0 text-xs"
            >
              {number}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={!canNext}
          onClick={() => {
            if (canNext) onNext();
          }}
          className="size-8 shrink-0"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
