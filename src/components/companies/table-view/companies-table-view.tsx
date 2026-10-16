"use client";

import { useMemo, useState } from "react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { ChevronDown, Columns3, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableView, type TableColumn } from "@/components/common/table-view";
import { TableMenu } from "@/components/common/table-menu";
import type { TableSort } from "@/types/table-views";
import type { CompanySummary } from "@/types/companies";
import { CompanyMembers } from "../company-members";

export type CompanyActionProps = {
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

const TOGGLE_COLUMNS = [
  { id: "member_count", label: "Members" },
  { id: "is_warehouse", label: "Warehouse" },
  { id: "warehouse_name", label: "Warehouse name" },
  { id: "warehouse_address", label: "Warehouse address" },
] as const;

type ToggleColumnId = (typeof TOGGLE_COLUMNS)[number]["id"];

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
export function CompanyDate({ value }: { value: string }) {
  return (
    <time dateTime={value}>
      {new Date(value).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
      })}
    </time>
  );
}
function countLabel(count: number, singular: string, plural: string) {
  if (count <= 0) return "—";
  return `${count} ${count === 1 ? singular : plural}`;
}

export function CompaniesTableView(props: Props) {
  const access = useRecordAccess();
  const [visible, setVisible] = useState<Record<ToggleColumnId, boolean>>({
    member_count: true,
    is_warehouse: true,
    warehouse_name: true,
    warehouse_address: true,
  });
  const columns = useMemo(() => {
    const all: TableColumn<CompanySummary>[] = [
      {
        id: "name",
        header: "Company",
        className: "font-semibold",
        sortable: true,
        freezable: true,
        value: (company) => company.name,
        cell: (company) => company.name,
      },
      {
        id: "member_count",
        header: "Members",
        freezable: true,
        value: (company) => company.member_count,
        cell: (company) =>
          countLabel(company.member_count, "member", "members"),
      },
      {
        id: "is_warehouse",
        header: "Warehouse",
        freezable: true,
        value: (company) => (company.is_warehouse ? "Yes" : "No"),
        cell: (company) => (company.is_warehouse ? "Yes" : "No"),
      },
      {
        id: "warehouse_name",
        header: "Warehouse name",
        freezable: true,
        value: (company) => company.warehouse_name ?? "",
        cell: (company) => company.warehouse_name || "—",
      },
      {
        id: "warehouse_address",
        header: "Warehouse address",
        freezable: true,
        value: (company) => company.warehouse_address ?? "",
        cell: (company) => company.warehouse_address || "—",
      },
      {
        id: "created_at",
        header: "Created",
        sortable: true,
        freezable: true,
        cell: (company) => <CompanyDate value={company.created_at} />,
      },
    ];
    return all.filter((column) => {
      if (column.id in visible)
        return visible[column.id as ToggleColumnId];
      return true;
    });
  }, [visible]);
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
        caption="Companies, members, and locations"
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
