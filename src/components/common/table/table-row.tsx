"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableColumn } from "./table-column";

/** Left and right space inside each data cell. */
export const rowPadding = "px-4";
/** Data row height. */
export const rowHeight = "py-3.5";

export const rowCellClass = cn(
  "whitespace-nowrap border-b bg-white align-middle text-sm text-foreground group-hover:bg-gray-50",
  rowPadding,
  rowHeight,
);

function TableRowCell<T>({
  column,
  row,
  pinned,
  style,
  wrap,
}: {
  column: TableColumn<T>;
  row: T;
  pinned: boolean;
  style?: CSSProperties;
  wrap: boolean;
}) {
  return (
    <td
      style={style}
      className={cn(
        rowCellClass,
        wrap && "whitespace-normal break-words",
        pinned && "sticky z-10 border-r",
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

export interface TableAction<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: (row: T) => void;
  hidden?: (row: T) => boolean;
  disabled?: boolean | ((row: T) => boolean);
  description?: string | ((row: T) => string | undefined);
  destructive?: boolean;
  className?: string;
}

export function TableRow<T>({
  row,
  rowKey,
  columns,
  pinned,
  cellStyle,
  expandedRow,
  isExpanded,
  onToggleExpanded,
  detailsId,
  actions,
  showActions,
  actionsDisabled,
  wrap = false,
  columnSpan,
}: {
  row: T;
  rowKey: string;
  columns: readonly TableColumn<T>[];
  pinned: (column: TableColumn<T>) => boolean;
  cellStyle: (column: TableColumn<T>) => CSSProperties;
  expandedRow?: (row: T) => ReactNode;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  detailsId: string;
  actions: readonly TableAction<T>[];
  showActions: boolean;
  actionsDisabled: boolean;
  wrap?: boolean;
  columnSpan: number;
}) {
  return (
    <Fragment>
      <tr className="group">
        {expandedRow && (
          <td className="sticky left-0 z-20 border-b bg-white px-2 group-hover:bg-slate-50">
            <button
              type="button"
              aria-label={`${isExpanded ? "Collapse" : "Expand"} row ${rowKey}`}
              aria-expanded={isExpanded}
              aria-controls={detailsId}
              onClick={onToggleExpanded}
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
        {columns.map((column) => (
          <TableRowCell
            key={column.id}
            column={column}
            row={row}
            pinned={pinned(column)}
            style={cellStyle(column)}
            wrap={wrap}
          />
        ))}
        {showActions && (
          <td
            className={cn(rowCellClass, "text-right", wrap ? "whitespace-normal" : "whitespace-nowrap")}
          >
            <div className="flex items-center justify-end gap-4">
              {actions.map((action) => {
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
                      "inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-[4px] px-2 py-1 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline",
                      action.destructive,
                      action.className,
                    )}
                  >
                    {action.icon && (
                      <span className="[&_svg]:size-3">{action.icon}</span>
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
          <td colSpan={columnSpan} className="border-b bg-blue-50/60 p-0">
            <div
              id={detailsId}
              role="region"
              aria-label={`Details for row ${rowKey}`}
              className="p-4 motion-safe:animate-[fade-in_150ms_ease-out]"
            >
              {isExpanded && expandedRow(row)}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
