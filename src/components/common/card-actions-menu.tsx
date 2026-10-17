"use client";

import { EllipsisVertical } from "lucide-react";
import { TableMenu, type TableMenuItem } from "./table/table-menu";

export function CardActionsMenu({
  label,
  items,
  disabled,
}: {
  label: string;
  items: TableMenuItem[];
  disabled?: boolean;
}) {
  return (
    <TableMenu
      label={label}
      items={items}
      disabled={disabled}
      className="size-8 shrink-0 justify-center rounded-md px-0 text-muted-foreground hover:bg-gray-100"
    >
      <EllipsisVertical className="size-4" aria-hidden="true" />
    </TableMenu>
  );
}
