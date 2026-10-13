"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortValue } from "@/lib/table";
import { TableMenu, type TableMenuItem } from "./table-menu";

/** Left and right space inside each header. */
export const columnPadding = "px-3";
/** Header height. */
export const columnHeaderHeight = "py-2.5";

export const columnHeaderClass = cn(
  "border-b bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500 font-bold",
  columnPadding,
  columnHeaderHeight,
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
  pinned = false,
  sorted = null,
  style,
  headerRef,
  menu = [],
  align = "left",
}: {
  column: TableColumn<T>;
  pinned?: boolean;
  sorted?: "asc" | "desc" | null;
  style?: CSSProperties;
  headerRef?: (node: HTMLTableCellElement | null) => void;
  menu?: TableMenuItem[];
  align?: "left" | "right";
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
        align === "right" ? "text-right" : "text-left",
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
