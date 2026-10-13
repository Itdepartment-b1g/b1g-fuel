"use client";

import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Clock3,
  Pin,
  PinOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sortTableRows, type SortValue, type TableSort } from "@/lib/table";
import { TableMenu, type TableMenuItem } from "./table-menu";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  width?: number;
  value?: (row: T) => SortValue;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  sortField?: string;
  compare?: (a: T, b: T) => number;
  freezable?: boolean;
  className?: string;
}
export interface DataTableAction<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: (row: T) => void;
  hidden?: (row: T) => boolean;
  disabled?: boolean | ((row: T) => boolean);
  description?: string | ((row: T) => string | undefined);
  destructive?: boolean;
}
export interface DataTableProps<T> {
  data: readonly T[];
  columns: readonly DataTableColumn<T>[];
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  sortingMode?: "client" | "server";
  sorting?: TableSort | null;
  onSortingChange?: (sorting: TableSort | null) => void;
  defaultSorting?: TableSort;
  defaultSortValue?: (row: T) => SortValue;
  multipleFrozenColumns?: boolean;
  initialFrozenColumns?: string[];
  expandedRow?: (row: T) => ReactNode;
  expansionMode?: "single" | "multiple";
  actions?:
    | readonly DataTableAction<T>[]
    | ((row: T) => readonly DataTableAction<T>[]);
  actionsDisabled?: boolean;
  className?: string;
}

/** Configurable table with independent sorting, pinned columns, row details and actions; pagination stays with its parent. */
export function DataTable<T>({
  data,
  columns,
  rowKey,
  caption,
  loading = false,
  skeletonRows = 5,
  emptyTitle = "No records found",
  emptyDescription = "There are no records to display at the moment.",
  sortingMode = "client",
  sorting,
  onSortingChange,
  defaultSorting = { field: "created_at", direction: "desc" },
  defaultSortValue,
  multipleFrozenColumns = false,
  initialFrozenColumns = [],
  expandedRow,
  expansionMode = "single",
  actions,
  actionsDisabled = false,
  className,
}: DataTableProps<T>) {
  const id = useId();
  const [localSort, setLocalSort] = useState<TableSort | null>(null);
  const activeSort = sorting === undefined ? localSort : sorting;
  const currentSort = activeSort ?? defaultSorting;
  const [frozen, setFrozen] = useState<string[]>(() =>
    multipleFrozenColumns
      ? initialFrozenColumns
      : initialFrozenColumns.slice(0, 1),
  );
  const [expanded, setExpanded] = useState<string[]>([]);
  const headers = useRef(new Map<string, HTMLTableCellElement>());
  const table = useRef<HTMLTableElement>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const ordered = useMemo(
    () => [
      ...columns.filter(
        (column) => column.freezable && frozen.includes(column.id),
      ),
      ...columns.filter(
        (column) => !column.freezable || !frozen.includes(column.id),
      ),
    ],
    [columns, frozen],
  );
  useEffect(() => {
    if (!table.current) return;
    const observer = new ResizeObserver(() => {
      const next = Object.fromEntries(
        [...headers.current].map(([key, node]) => [
          key,
          node.getBoundingClientRect().width,
        ]),
      );
      setWidths((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    });
    observer.observe(table.current);
    for (const node of headers.current.values()) observer.observe(node);
    return () => observer.disconnect();
  }, [ordered, Boolean(expandedRow)]);
  const sorted = useMemo(() => {
    if (sortingMode === "server") return data;
    const column = columns.find(
      (column) => (column.sortField ?? column.id) === currentSort.field,
    );
    const value =
      column?.value ??
      (currentSort.field === defaultSorting.field
        ? defaultSortValue
        : undefined) ??
      ((row: T) => (row as Record<string, SortValue>)[currentSort.field]);
    return sortTableRows(data, currentSort, value, rowKey, column?.compare);
  }, [
    data,
    sortingMode,
    columns,
    currentSort.field,
    currentSort.direction,
    defaultSorting.field,
    defaultSortValue,
    rowKey,
  ]);
  function changeSort(next: TableSort | null) {
    setLocalSort(next);
    onSortingChange?.(next);
  }
  function toggleFrozen(column: string) {
    setFrozen((previous) =>
      previous.includes(column)
        ? previous.filter((value) => value !== column)
        : multipleFrozenColumns
          ? [...previous, column]
          : [column],
    );
  }
  function toggleExpanded(key: string) {
    setExpanded((previous) =>
      previous.includes(key)
        ? previous.filter((value) => value !== key)
        : expansionMode === "multiple"
          ? [...previous, key]
          : [key],
    );
  }
  function cellStyle(column: DataTableColumn<T>): CSSProperties {
    if (!column.freezable || !frozen.includes(column.id)) return {};
    const before = ordered.slice(0, ordered.indexOf(column));
    return {
      position: "sticky",
      left:
        (expandedRow ? (widths.__expand ?? 44) : 0) +
        before
          .filter((item) => item.freezable && frozen.includes(item.id))
          .reduce(
            (sum, item) => sum + (widths[item.id] ?? item.width ?? 180),
            0,
          ),
    };
  }
  const span = columns.length + (expandedRow ? 1 : 0) + (actions ? 1 : 0);
  const defaultLabel =
    defaultSorting.field === "created_at" && defaultSorting.direction === "desc"
      ? "Default (Latest First)"
      : "Default";
  return (
    <div
      className={cn("relative w-full min-w-0 overflow-x-auto", className)}
      aria-busy={loading}
    >
      <table
        ref={table}
        className="w-full border-separate border-spacing-0 text-sm"
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {expandedRow && (
              <th
                ref={(node) => {
                  if (node) headers.current.set("__expand", node);
                  else headers.current.delete("__expand");
                }}
                className="sticky left-0 z-30 border-b bg-slate-50"
              >
                <span className="sr-only">Expand details</span>
              </th>
            )}
            {ordered.map((column) => {
              const selected = Boolean(
                activeSort &&
                activeSort.field === (column.sortField ?? column.id),
              );
              const pinned = Boolean(
                column.freezable && frozen.includes(column.id),
              );
              const menu: TableMenuItem[] = [];
              if (column.sortable)
                menu.push(
                  {
                    id: "default",
                    label: defaultLabel,
                    description:
                      defaultSorting.field === "created_at"
                        ? "Sort by creation date (newest first)"
                        : `Sort by ${defaultSorting.field}`,
                    icon: <Clock3 />,
                    selected: activeSort === null,
                    onSelect: () => changeSort(null),
                  },
                  {
                    id: "asc",
                    label: "Ascending",
                    description: "A–Z, smallest to largest, oldest first",
                    icon: <ArrowUp />,
                    selected: selected && activeSort?.direction === "asc",
                    onSelect: () =>
                      changeSort({
                        field: column.sortField ?? column.id,
                        direction: "asc",
                      }),
                  },
                  {
                    id: "desc",
                    label: "Descending",
                    description: "Z–A, largest to smallest, newest first",
                    icon: <ArrowDown />,
                    selected: selected && activeSort?.direction === "desc",
                    onSelect: () =>
                      changeSort({
                        field: column.sortField ?? column.id,
                        direction: "desc",
                      }),
                  },
                );
              if (column.freezable)
                menu.push({
                  id: "freeze",
                  label: pinned ? "Unfreeze Column" : "Freeze Column",
                  description: pinned
                    ? "Restore normal scrolling"
                    : "Keep this column visible while scrolling",
                  icon: pinned ? <PinOff /> : <Pin />,
                  separatorBefore: Boolean(column.sortable),
                  onSelect: () => toggleFrozen(column.id),
                });
              const heading = (
                <>
                  <span className="truncate">{column.header}</span>
                  {pinned && (
                    <Pin
                      className="size-3.5 shrink-0 text-gray-400"
                      aria-label="Frozen column"
                    />
                  )}
                  {column.sortable &&
                    (selected ? (
                      activeSort?.direction === "asc" ? (
                        <ArrowUp className="size-3.5 text-gray-400" />
                      ) : (
                        <ArrowDown className="size-3.5 text-gray-400" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3.5 text-gray-400" />
                    ))}
                </>
              );
              return (
                <th
                  key={column.id}
                  scope="col"
                  ref={(node) => {
                    if (node) headers.current.set(column.id, node);
                    else headers.current.delete(column.id);
                  }}
                  aria-sort={
                    selected
                      ? activeSort?.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  style={cellStyle(column)}
                  className={cn(
                    "border-b bg-white px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500",
                    pinned &&
                      "sticky z-20 border-r bg-white shadow-[2px_0_4px_-3px_rgba(0,0,0,0.3)]",
                  )}
                >
                  {menu.length ? (
                    <TableMenu
                      label={`${column.header} column options`}
                      items={menu}
                      className="-ml-2 max-w-full uppercase tracking-wider"
                    >
                      {heading}
                    </TableMenu>
                  ) : (
                    heading
                  )}
                </th>
              );
            })}
            {actions && (
              <th
                scope="col"
                className="border-b bg-white px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading && !data.length ? (
            Array.from({ length: skeletonRows }, (_, index) => (
              <tr key={index} aria-hidden="true">
                {Array.from({ length: span }, (_, cell) => (
                  <td key={cell} className="border-b p-4">
                    <div className="h-4 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
                  </td>
                ))}
              </tr>
            ))
          ) : !sorted.length ? (
            <tr>
              <td
                colSpan={span}
                className="px-6 py-16 text-center text-sm text-muted-foreground"
              >
                {emptyDescription || emptyTitle}
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const key = rowKey(row),
                isExpanded = expanded.includes(key),
                detailsId = `${id}-details-${encodeURIComponent(key)}`;
              const available = (
                typeof actions === "function" ? actions(row) : (actions ?? [])
              ).filter((action) => !action.hidden?.(row));
              return (
                <Fragment key={key}>
                  <tr className="group">
                    {expandedRow && (
                      <td className="sticky left-0 z-20 border-b bg-white px-2 group-hover:bg-slate-50">
                        <button
                          type="button"
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} row ${key}`}
                          aria-expanded={isExpanded}
                          aria-controls={detailsId}
                          onClick={() => toggleExpanded(key)}
                          className="rounded p-1.5 focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </td>
                    )}
                    {ordered.map((column) => (
                      <td
                        key={column.id}
                        style={cellStyle(column)}
                        className={cn(
                          "border-b bg-white px-4 py-3.5 align-middle text-foreground group-hover:bg-gray-50",
                          column.freezable &&
                            frozen.includes(column.id) &&
                            "sticky z-10 border-r shadow-[2px_0_4px_-3px_rgba(0,0,0,0.3)]",
                          column.className,
                        )}
                      >
                        {column.cell
                          ? column.cell(row)
                          : column.value?.(row) instanceof Date
                            ? String(column.value(row))
                            : String(column.value?.(row) ?? "—")}
                      </td>
                    ))}
                    {actions && (
                      <td className="border-b bg-white px-4 py-3.5 text-right whitespace-nowrap group-hover:bg-gray-50">
                        <div className="flex items-center justify-end gap-4">
                          {available.map((action) => {
                            const disabled =
                              actionsDisabled ||
                              (typeof action.disabled === "function"
                                ? action.disabled(row)
                                : action.disabled);
                            const description =
                              typeof action.description === "function"
                                ? action.description(row)
                                : action.description;
                            return (
                              <button
                                key={action.id}
                                type="button"
                                disabled={disabled}
                                title={description}
                                onClick={() => action.onSelect(row)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline",
                                  action.destructive && "text-destructive",
                                )}
                              >
                                {action.icon && (
                                  <span className="[&_svg]:size-3.5">
                                    {action.icon}
                                  </span>
                                )}
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                  {expandedRow && (
                    <tr hidden={!isExpanded}>
                      <td colSpan={span} className="border-b bg-blue-50/60 p-0">
                        <div
                          id={detailsId}
                          role="region"
                          aria-label={`Details for row ${key}`}
                          className="p-4 motion-safe:animate-[fade-in_150ms_ease-out]"
                        >
                          {isExpanded && expandedRow(row)}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      {loading && (
        <span role="status" className="sr-only">
          Loading records
        </span>
      )}
    </div>
  );
}
