"use client";

import { useMemo, useState } from "react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { ChevronDown, Columns3, Link2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableView } from "@/components/common/table/table-view";
import { TableMenu } from "@/components/common/table/table-menu";
import type { TableSort } from "@/types/table-views";
import type { CompanySummary } from "@/types/companies";
import { CompanyMembers } from "./company-members";
import {
  COMPANY_TABLE_COLUMNS,
  TOGGLE_COLUMNS,
  type ToggleColumnId,
} from "./company-table-columns";

export type CompanyActionProps = {
  onSupplyLinks?: (company: CompanySummary) => void;
  onEdit: (company: CompanySummary) => void;
  onDelete: (company: CompanySummary) => void;
  disabled: boolean;
};

type Props = CompanyActionProps & {
  companies: CompanySummary[];
  loading?: boolean;
  sorting?: TableSort | null;
  onSortingChange?: (sorting: TableSort | null) => void;
};

export function CompanyActions({
  company,
  onEdit,
  onDelete,
  disabled,
}: CompanyActionProps & { company: CompanySummary }) {
  const access = useRecordAccess();
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${company.name}`}
        disabled={disabled || !canPerform(access, "companies", "edit", company)}
        onClick={() => onEdit(company)}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${company.name}`}
        title={
          company.member_count
            ? "Companies with members cannot be deleted"
            : "Delete company"
        }
        disabled={
          disabled ||
          company.member_count > 0 ||
          !canPerform(access, "companies", "delete", company)
        }
        onClick={() => onDelete(company)}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
export function CompaniesTableView(props: Props) {
  const access = useRecordAccess();
  const [visible, setVisible] = useState<Record<ToggleColumnId, boolean>>({
    member_count: true,
    is_warehouse: true,
    warehouse_name: true,
    warehouse_address: true,
  });
  const columns = useMemo(
    () =>
      COMPANY_TABLE_COLUMNS.filter((column) => {
        if (column.id in visible) return visible[column.id as ToggleColumnId];
        return true;
      }),
    [visible],
  );
  return (
    <div>
      <div className="flex justify-end border-b px-3 py-2">
        <TableMenu
          label="Toggle company table columns"
          items={TOGGLE_COLUMNS.map((column) => ({
            id: column.id,
            label: column.label,
            description: visible[column.id]
              ? "Hide this column"
              : "Show this column",
            selected: visible[column.id],
            onSelect: () =>
              setVisible((current) => ({
                ...current,
                [column.id]: !current[column.id],
              })),
          }))}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium normal-case tracking-normal text-primary hover:bg-gray-50"
        >
          <Columns3 className="size-4 shrink-0" aria-hidden="true" />
          Columns
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </TableMenu>
      </div>
      <TableView
        data={props.companies}
        rowKey={(company) => company.id}
        caption="Companies, members, and facilities"
        expandedRow={(company) => (
          <CompanyMembers key={company.id} companyId={company.id} />
        )}
        sortingMode={props.onSortingChange ? "server" : "client"}
        sorting={props.sorting}
        onSortingChange={props.onSortingChange}
        loading={props.loading}
        multipleFrozenColumns
        actionsDisabled={props.disabled}
        columns={columns}
        actions={[
          {
            id: "supply-links", label: "Supply links", icon: <Link2 />,
            hidden: () => !access?.superAdmin || !props.onSupplyLinks,
            onSelect: (company) => props.onSupplyLinks?.(company),
          },
          {
            id: "edit",
            label: "Edit",
            icon: <Pencil />,
            disabled: (company) =>
              !canPerform(access, "companies", "edit", company),
            onSelect: props.onEdit,
          },
          {
            id: "delete",
            label: "Delete",
            className: "border-gray-200 text-destructive",
            icon: <Trash2 />,
            destructive: true,
            disabled: (company) =>
              company.member_count > 0 ||
              !canPerform(access, "companies", "delete", company),
            description: (company) =>
              company.member_count
                ? "Companies with members cannot be deleted"
                : undefined,
            onSelect: props.onDelete,
          },
        ]}
      />
    </div>
  );
}
