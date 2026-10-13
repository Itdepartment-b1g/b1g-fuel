"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  columnCellHeight,
  columnHeaderClass,
  columnPadding,
  TableColumnCell,
  type TableColumn,
} from "./table-column";

export interface TableAction<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: (row: T) => void;
  hidden?: (row: T) => boolean;
  disabled?: boolean | ((row: T) => boolean);
  description?: string | ((row: T) => string | undefined);
  destructive?: boolean;
}

export function TableActionsHeader() {
  return (
    <th scope="col" className={cn(columnHeaderClass, "text-right")}>
      Actions
    </th>
  );
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
          <TableColumnCell
            key={column.id}
            column={column}
            row={row}
            pinned={pinned(column)}
            style={cellStyle(column)}
          />
        ))}
        {showActions && (
          <td
            className={cn(
              "border-b bg-white text-right whitespace-nowrap group-hover:bg-gray-50",
              columnPadding,
              columnCellHeight,
            )}
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
                      "inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline",
                      action.destructive && "text-destructive",
                    )}
                  >
                    {action.icon && (
                      <span className="[&_svg]:size-3.5">{action.icon}</span>
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
