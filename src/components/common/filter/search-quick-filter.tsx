"use client";

import { useRef, useState, type ComponentProps } from "react";
import { QuickFilter } from "./quick-filter";
import { SearchToolbar, type SearchToolbarProps } from "./search-toolbar";

export interface SearchQuickFilterProps extends Omit<
  SearchToolbarProps,
  "onQuickFilterClick" | "quickFilterOpen" | "quickFilterButtonRef"
> {
  filter: ComponentProps<typeof QuickFilter>;
}

/** Connect the toolbar button to the existing QuickFilter trigger without changing its panel implementation. */
export function SearchQuickFilter({
  filter,
  ...toolbar
}: SearchQuickFilterProps) {
  const existingTrigger = useRef<HTMLDivElement>(null);
  const visibleTrigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <SearchToolbar
        {...toolbar}
        quickFilterOpen={open}
        quickFilterButtonRef={visibleTrigger}
        onQuickFilterClick={() =>
          existingTrigger.current
            ?.querySelector<HTMLButtonElement>("button")
            ?.click()
        }
      />
      <div ref={existingTrigger} hidden>
        <QuickFilter
          {...filter}
          onOpenChange={(next) => {
            setOpen(next);
            filter.onOpenChange?.(next);
            if (!next)
              requestAnimationFrame(() => visibleTrigger.current?.focus());
          }}
        />
      </div>
    </>
  );
}
