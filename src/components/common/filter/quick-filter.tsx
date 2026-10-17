"use client";

import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DateRangeMenu } from "@/components/common/date-range-menu";
import { addCondition, changeConditionField, countActiveFilters, createQuickFilterState, emptyCondition, fromDateMenuValue, isActiveCondition, removeCondition, toDateMenuValue } from "@/utils/quick-filter";
import type { AdditionalFilter, FilterField, FilterOption, QuickFilterState } from "@/types/quick-filter";

type QuickFilterProps = {
  value: QuickFilterState;
  onChange: (value: QuickFilterState) => void;
  fields: FilterField[];
  statusOptions: FilterOption[];
  additionalFilters?: AdditionalFilter[];
  labels?: {
    button?: string;
    title?: string;
    date?: string;
    conditions?: string;
    status?: string;
    allColumns?: string;
    any?: string;
  };
  onOpenChange?: (open: boolean) => void;
  maxConditions?: number;
};
const selectClass = "h-10 w-full rounded-[4px] border border-gray-200 bg-white px-3 text-sm";
export function QuickFilter({
  value,
  onChange,
  fields,
  statusOptions,
  additionalFilters = [],
  labels = {},
  onOpenChange,
  maxConditions = Infinity,
}: QuickFilterProps) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const [fallbackCondition] = useState(() => emptyCondition());
  const defaults = {
    date: "all",
    status: statusOptions[0]?.value ?? "",
    additional: Object.fromEntries(
      additionalFilters.map((filter) => [
        filter.key,
        filter.options[0]?.value ?? "",
      ]),
    ),
  };
  const count = countActiveFilters(value, defaults);
  const conditions = value.conditions.length
    ? value.conditions
    : [fallbackCondition];
  function changeOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }
  const lastActive = Boolean(
    conditions.length && isActiveCondition(conditions[conditions.length - 1]),
  );
  function keepDateMenu(event: { target: EventTarget | null; preventDefault: () => void }) {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-slot=popover-content]")
    ) {
      event.preventDefault();
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          className={
            count
              ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
              : ""
          }
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {labels.button ?? "Quick Filter"}
          {count > 0 && (
            <span
              className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-5 text-white"
              aria-label={`${count} active filters`}
            >
              {count}
            </span>
          )}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-white shadow-2xl outline-none sm:w-[460px]"
          aria-describedby={descriptionId}
          onPointerDownOutside={keepDateMenu}
          onFocusOutside={keepDateMenu}
          onInteractOutside={keepDateMenu}
        >
          <header className="flex items-start justify-between gap-3 border-b px-6 py-5">
            <div>
              <Dialog.Title className="text-xl font-semibold text-primary">
                {labels.title ?? "Quick Filter"}
              </Dialog.Title>
              <Dialog.Description
                id={descriptionId}
                className="mt-1 text-sm text-muted-foreground"
              >
                Results update as you change your filters.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close quick filter"
                className="rounded-md p-2 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{labels.date ?? "Date"}</h3>
              <DateRangeMenu
                value={toDateMenuValue(value.date)}
                onChange={(next) =>
                  onChange({ ...value, date: fromDateMenuValue(next) })
                }
                triggerClassName="w-full md:w-full"
                contentClassName="z-[60]"
              />
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">
                {labels.conditions ?? "Column conditions"}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Values in the same column match any choice. Different columns
                must all match.
              </p>
              {conditions.map((condition, index) => (
                <div
                  key={condition.id}
                  className="space-y-2 rounded-lg border bg-slate-50/60 p-3"
                >
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Condition ${index + 1} field`}
                      className={selectClass}
                      value={condition.field}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          conditions: changeConditionField(
                            conditions,
                            condition.id,
                            event.target.value,
                          ),
                        })
                      }
                    >
                      <option value="">
                        {labels.allColumns ?? "All columns"}
                      </option>
                      {fields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                    {conditions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove condition ${index + 1}`}
                        onClick={() =>
                          onChange({
                            ...value,
                            conditions: removeCondition(
                              conditions,
                              condition.id,
                            ),
                          })
                        }
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  {condition.field && (
                    <SearchableSelect
                      label={`Condition ${index + 1} value`}
                      value={condition.value}
                      options={
                        fields.find((field) => field.key === condition.field)
                          ?.options ?? []
                      }
                      anyLabel={labels.any ?? "Any"}
                      onChange={(next) =>
                        onChange({
                          ...value,
                          conditions: conditions.map((row) =>
                            row.id === condition.id
                              ? { ...row, value: next }
                              : row,
                          ),
                        })
                      }
                    />
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                disabled={!lastActive || conditions.length >= maxConditions}
                onClick={() =>
                  onChange({ ...value, conditions: addCondition(conditions) })
                }
              >
                <Plus className="size-4" />
                Add condition
              </Button>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">
                {labels.status ?? "Status"}
              </h3>
              <select
                aria-label={labels.status ?? "Status"}
                className={selectClass}
                value={value.status}
                onChange={(event) =>
                  onChange({ ...value, status: event.target.value })
                }
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.count !== undefined ? ` (${option.count})` : ""}
                  </option>
                ))}
              </select>
            </section>
            {additionalFilters.map((filter) => (
              <section key={filter.key} className="space-y-3">
                <h3 className="text-sm font-semibold">{filter.label}</h3>
                <select
                  aria-label={filter.label}
                  className={selectClass}
                  value={
                    value.additional[filter.key] ??
                    filter.options[0]?.value ??
                    ""
                  }
                  onChange={(event) =>
                    onChange({
                      ...value,
                      additional: {
                        ...value.additional,
                        [filter.key]: event.target.value,
                      },
                    })
                  }
                >
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                      {option.count !== undefined ? ` (${option.count})` : ""}
                    </option>
                  ))}
                </select>
              </section>
            ))}
          </div>
          <footer className="flex items-center justify-end gap-3 border-t px-6 py-4">
            {count > 0 && (
              <Button
                variant="ghost"
                onClick={() => onChange(createQuickFilterState(defaults))}
              >
                Clear
              </Button>
            )}
            <Dialog.Close asChild>
              <Button>Done</Button>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
