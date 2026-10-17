"use client";

import { useRef, useState, type ReactNode, type Ref } from "react";
import { LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchToolbarProps {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearch: (value: string) => void | Promise<void>;
  placeholder?: string;
  searchLabel?: string;
  searchButtonLabel?: string;
  loadingLabel?: string;
  maxLength?: number;
  loading?: boolean;
  disabled?: boolean;
  onClearSearch?: () => void;
  canClearSearch?: boolean;
  onSearchError?: (error: unknown) => void;
  onQuickFilterClick?: () => void;
  quickFilterLabel?: string;
  quickFilterDisabled?: boolean;
  quickFilterActive?: boolean;
  quickFilterOpen?: boolean;
  quickFilterButtonRef?: Ref<HTMLButtonElement>;
  trailingContent?: ReactNode;
  className?: string;
}

/** Controlled search controls and a callback-only filter button; filter panels and pagination belong to the parent. */
export function SearchToolbar({
  searchValue,
  onSearchValueChange,
  onSearch,
  placeholder = "Search by name or email",
  searchLabel = "Search records",
  searchButtonLabel = "Search",
  loadingLabel = "Searching…",
  maxLength,
  loading = false,
  disabled = false,
  onClearSearch,
  canClearSearch = false,
  onSearchError,
  onQuickFilterClick,
  quickFilterLabel = "Quick Filter",
  quickFilterDisabled = false,
  quickFilterActive = false,
  quickFilterOpen,
  quickFilterButtonRef,
  trailingContent,
  className,
}: SearchToolbarProps) {
  const running = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = loading || submitting;
  async function submit() {
    if (disabled || busy || running.current) return;
    running.current = true;
    setSubmitting(true);
    try {
      await onSearch(searchValue.trim());
    } catch (error) {
      if (onSearchError) onSearchError(error);
      else console.error("Search request failed", error);
    } finally {
      running.current = false;
      setSubmitting(false);
    }
  }
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <form
        role="search"
        aria-label={searchLabel}
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-0 sm:max-w-2xl"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={input}
            type="search"
            aria-label={searchLabel}
            placeholder={placeholder}
            maxLength={maxLength}
            value={searchValue}
            disabled={disabled}
            onChange={(event) => onSearchValueChange(event.target.value)}
            className="rounded-lg pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {(searchValue.length > 0 || canClearSearch) && (
            <button
              type="button"
              aria-label="Clear search"
              disabled={disabled || busy}
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-slate-100 disabled:opacity-40"
              onClick={() => {
                onSearchValueChange("");
                onClearSearch?.();
                input.current?.focus();
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <Button
          type="submit"
          disabled={disabled || busy}
          className="shrink-0 rounded-lg px-5"
        >
          {busy && (
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          {busy ? loadingLabel : searchButtonLabel}
        </Button>
      </form>
      {(onQuickFilterClick || trailingContent) && (
        <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center gap-2">
          {trailingContent}
          {onQuickFilterClick && (
            <Button
              ref={quickFilterButtonRef}
              type="button"
              variant="outline"
              disabled={disabled || quickFilterDisabled}
              onClick={onQuickFilterClick}
              aria-expanded={quickFilterOpen}
              aria-haspopup={
                quickFilterOpen === undefined ? undefined : "dialog"
              }
              className={cn(
                "rounded-lg",
                quickFilterActive &&
                  "border-primary bg-primary/10 text-primary",
              )}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {quickFilterLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
