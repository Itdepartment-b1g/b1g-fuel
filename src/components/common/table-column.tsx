"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortValue } from "@/lib/table";
import { TableMenu, type TableMenuItem } from "./table-menu";

/** Left and right space inside each column. */
export const columnPadding = "px-2";
/** Header row height. */
export const columnHeaderHeight = "py-2";
/** Data column height. */
export const columnCellHeight = "py-1.5";

export const columnHeaderClass = cn(
  "border-b bg-white text-xs font-medium uppercase tracking-wider text-gray-500",
  columnPadding,
  columnHeaderHeight,
);
export const columnCellClass = cn(
  "border-b bg-white align-middle text-foreground group-hover:bg-gray-50",
  columnPadding,
  columnCellHeight,
);

export interface TableColumn<T> {
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

export function TableColumnHeader<T>({
  column,
  pinned,
  sorted,
  style,
  headerRef,
  menu,
}: {
  column: TableColumn<T>;
  pinned: boolean;
  sorted: "asc" | "desc" | null;
  style?: CSSProperties;
  headerRef: (node: HTMLTableCellElement | null) => void;
  menu: TableMenuItem[];
}) {
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
        (sorted === "asc" ? (
          <ArrowUp className="size-3.5 text-gray-400" />
        ) : sorted === "desc" ? (
          <ArrowDown className="size-3.5 text-gray-400" />
        ) : (
          <ArrowUpDown className="size-3.5 text-gray-400" />
        ))}
    </>
  );
  return (
    <th
      scope="col"
      ref={headerRef}
      aria-sort={
        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
      }
      style={style}
      className={cn(
        columnHeaderClass,
        "text-left",
        pinned &&
          "sticky z-20 border-r bg-white shadow-[2px_0_4px_-3px_rgba(0,0,0,0.3)]",
      )}
    >
      {menu.length ? (
        <TableMenu
          label={`${column.header} column options`}
          items={menu}
          className="-ml-2 min-h-0 max-w-full py-0 uppercase tracking-wider"
        >
          {heading}
        </TableMenu>
      ) : (
        heading
      )}
    </th>
  );
}

export function TableColumnCell<T>({
  column,
  row,
  pinned,
  style,
}: {
  column: TableColumn<T>;
  row: T;
  pinned: boolean;
  style?: CSSProperties;
}) {
  return (
    <td
      style={style}
      className={cn(
        columnCellClass,
        pinned && "sticky z-10 border-r shadow-[2px_0_4px_-3px_rgba(0,0,0,0.3)]",
        column.className,
      )}
    >
      {column.cell
        ? column.cell(row)
        : column.value?.(row) instanceof Date
          ? String(column.value(row))
          : String(column.value?.(row) ?? "—")}
    </td>
  );
}
