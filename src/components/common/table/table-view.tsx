"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, Clock3, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { sortTableRows } from "@/utils/table-views";
import type { SortValue, TableSort } from "@/types/table-views";
import type { TableMenuItem } from "./table-menu";
import { TableColumnHeader, type TableColumn } from "./table-column";
import { TableRow, type TableAction } from "./table-row";

export type { TableColumn } from "./table-column";
export type { TableAction } from "./table-row";

export interface TableViewProps<T> {
  data: readonly T[];
  columns: readonly TableColumn<T>[];
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
    | readonly TableAction<T>[]
    | ((row: T) => readonly TableAction<T>[]);
  actionsDisabled?: boolean;
  /** Wrap columns inside the parent width instead of scrolling sideways. */
  fit?: boolean;
  className?: string;
}

/** Combines table columns, rows, and the header menu. Pagination stays with the list. */
export function TableView<T>({
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
  fit = false,
  className,
}: TableViewProps<T>) {
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
  const showActions = Boolean(actions);
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
  function cellStyle(column: TableColumn<T>): CSSProperties {
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
  const span = columns.length + (expandedRow ? 1 : 0) + (showActions ? 1 : 0);
  const defaultLabel =
    defaultSorting.field === "created_at" &&
    defaultSorting.direction === "desc"
      ? "Default (Latest First)"
      : "Default";
  return (
    <div
      className={cn(
        "relative w-full min-w-0",
        fit ? "overflow-hidden" : "overflow-x-auto",
        className,
      )}
      aria-busy={loading}
    >
      <table
        ref={table}
        className={cn(
          "border-separate border-spacing-0 text-sm",
          fit ? "w-full table-fixed" : "w-max min-w-full",
        )}
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
              return (
                <TableColumnHeader
                  key={column.id}
                  column={column}
                  wrap={fit}
                  pinned={pinned}
                  sorted={
                    selected
                      ? activeSort?.direction === "asc"
                        ? "asc"
                        : "desc"
                      : null
                  }
                  style={cellStyle(column)}
                  headerRef={(node) => {
                    if (node) headers.current.set(column.id, node);
                    else headers.current.delete(column.id);
                  }}
                  menu={menu}
                />
              );
            })}
            {showActions && (
              <TableColumnHeader
                column={{ id: "actions", header: "Actions" }}
                align="right"
                wrap={fit}
              />
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
              const key = rowKey(row);
              const available = (
                typeof actions === "function" ? actions(row) : (actions ?? [])
              ).filter((action) => !action.hidden?.(row));
              return (
                <TableRow
                  key={key}
                  row={row}
                  rowKey={key}
                  columns={ordered}
                  pinned={(column) =>
                    Boolean(column.freezable && frozen.includes(column.id))
                  }
                  cellStyle={cellStyle}
                  expandedRow={expandedRow}
                  isExpanded={expanded.includes(key)}
                  onToggleExpanded={() => toggleExpanded(key)}
                  detailsId={`${id}-details-${encodeURIComponent(key)}`}
                  actions={available}
                  showActions={showActions}
                  actionsDisabled={actionsDisabled}
                  wrap={fit}
                  columnSpan={span}
                />
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
