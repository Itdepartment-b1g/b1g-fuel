"use client";

import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/data-table";
import type { TableSort } from "@/lib/table";
import type { CompanySummary } from "@/server/schema/companies_schema";

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

export function CompanyActions({ company, onEdit, onDelete, disabled }: CompanyActionProps & { company: CompanySummary }) {
  const access = useRecordAccess();
  return <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${company.name}`} disabled={disabled || !canPerform(access, "companies", "edit", company)} onClick={() => onEdit(company)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${company.name}`} title={company.member_count ? "Companies with members cannot be deleted" : "Delete company"} disabled={disabled || company.member_count > 0 || !canPerform(access, "companies", "delete", company)} onClick={() => onDelete(company)}><Trash2 className="size-4 text-destructive" /></Button></div>;
}
export function CompanyDate({ value }: { value: string }) { return <time dateTime={value}>{new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" })}</time>; }
export function CompaniesTableView(props: Props) {
  const access = useRecordAccess();
  return <DataTable data={props.companies} rowKey={company => company.id} caption="Organization companies and membership counts"
    sortingMode={props.onSortingChange ? "server" : "client"} sorting={props.sorting} onSortingChange={props.onSortingChange} loading={props.loading} multipleFrozenColumns actionsDisabled={props.disabled}
    columns={[
      { id: "name", header: "Company", width: 280, sortable: true, freezable: true, value: company => company.name,
        cell: company => <div className="flex items-center gap-3"><Building2 className="size-5 shrink-0 text-primary" aria-hidden="true" /><span className="font-medium">{company.name}</span></div> },
      { id: "member_count", header: "Members", width: 140, freezable: true, value: company => company.member_count },
      { id: "created_at", header: "Created", width: 180, sortable: true, freezable: true, cell: company => <CompanyDate value={company.created_at} /> },
    ]}
    actions={[
      { id: "edit", label: "Edit", icon: <Pencil />, disabled: company => !canPerform(access, "companies", "edit", company), onSelect: props.onEdit },
      { id: "delete", label: "Delete", icon: <Trash2 />, destructive: true, disabled: company => company.member_count > 0 || !canPerform(access, "companies", "delete", company),
        description: company => company.member_count ? "Companies with members cannot be deleted" : undefined, onSelect: props.onDelete },
    ]} />;
}
