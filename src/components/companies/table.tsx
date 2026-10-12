"use client";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/data-table";
import type { TableSort } from "@/lib/table";
import type { CompanySummary } from "@/server/schema/companies_schema";

type Props = { companies: CompanySummary[]; onEdit: (company: CompanySummary) => void; onDelete: (company: CompanySummary) => void; disabled: boolean; loading?: boolean; sorting?: TableSort | null; onSortingChange?: (sorting: TableSort | null) => void };
function CompanyActions({ company, onEdit, onDelete, disabled }: Omit<Props, "companies"> & { company: CompanySummary }) {
  return <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${company.name}`} disabled={disabled} onClick={() => onEdit(company)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${company.name}`} title={company.member_count ? "Companies with members cannot be deleted" : "Delete company"} disabled={disabled || company.member_count > 0} onClick={() => onDelete(company)}><Trash2 className="size-4 text-destructive" /></Button></div>;
}
function CompanyDate({ value }: { value: string }) { return <time dateTime={value}>{new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" })}</time>; }
export function CompaniesTable(props: Props) {
  return <DataTable data={props.companies} rowKey={company => company.id} caption="Organization companies and membership counts"
    sortingMode={props.onSortingChange ? "server" : "client"} sorting={props.sorting} onSortingChange={props.onSortingChange} loading={props.loading} multipleFrozenColumns actionsDisabled={props.disabled}
    columns={[
      { id: "name", header: "Company", width: 280, sortable: true, freezable: true, value: company => company.name,
        cell: company => <div className="flex items-center gap-3"><Building2 className="size-5 shrink-0 text-primary" aria-hidden="true" /><span className="font-medium">{company.name}</span></div> },
      { id: "member_count", header: "Members", width: 140, freezable: true, value: company => company.member_count },
      { id: "created_at", header: "Created", width: 180, sortable: true, freezable: true, cell: company => <CompanyDate value={company.created_at} /> },
    ]}
    actions={[
      { id: "edit", label: "Edit", icon: <Pencil />, onSelect: props.onEdit },
      { id: "delete", label: "Delete", icon: <Trash2 />, destructive: true, disabled: company => company.member_count > 0,
        description: company => company.member_count ? "Companies with members cannot be deleted" : undefined, onSelect: props.onDelete },
    ]} />;
}
export function CompaniesCards(props: Props) {
  return <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">{props.companies.map(company => <article key={company.id} className="rounded-xl border p-5"><Building2 className="mb-4 size-7 text-primary" aria-hidden="true" /><h2 className="break-words font-semibold">{company.name}</h2><p className="mt-2 text-sm text-muted-foreground">{company.member_count} {company.member_count === 1 ? "member" : "members"}</p><p className="mt-2 text-xs text-muted-foreground">Created <CompanyDate value={company.created_at} /></p><div className="mt-4 border-t pt-2"><CompanyActions {...props} company={company} /></div></article>)}</div>;
}
