import { Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CompanySummary } from "@/server/schema/companies_schema";

type Props = { companies: CompanySummary[]; onEdit: (company: CompanySummary) => void; onDelete: (company: CompanySummary) => void; disabled: boolean };
function CompanyActions({ company, onEdit, onDelete, disabled }: Omit<Props, "companies"> & { company: CompanySummary }) {
  return <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${company.name}`} disabled={disabled} onClick={() => onEdit(company)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${company.name}`} title={company.member_count ? "Companies with members cannot be deleted" : "Delete company"} disabled={disabled || company.member_count > 0} onClick={() => onDelete(company)}><Trash2 className="size-4 text-destructive" /></Button></div>;
}
function CompanyDate({ value }: { value: string }) { return <time dateTime={value}>{new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" })}</time>; }
export function CompaniesTable(props: Props) {
  return <Table><caption className="sr-only">Organization companies and membership counts</caption><TableHeader><TableRow className="bg-slate-50"><TableHead>Company</TableHead><TableHead>Members</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{props.companies.map(company => <TableRow key={company.id}><TableCell><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-5" aria-hidden="true" /></span><span className="font-medium">{company.name}</span></div></TableCell><TableCell>{company.member_count}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground"><CompanyDate value={company.created_at} /></TableCell><TableCell><CompanyActions {...props} company={company} /></TableCell></TableRow>)}</TableBody></Table>;
}
export function CompaniesCards(props: Props) {
  return <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">{props.companies.map(company => <article key={company.id} className="rounded-xl border p-5"><Building2 className="mb-4 size-7 text-primary" aria-hidden="true" /><h2 className="break-words font-semibold">{company.name}</h2><p className="mt-2 text-sm text-muted-foreground">{company.member_count} {company.member_count === 1 ? "member" : "members"}</p><p className="mt-2 text-xs text-muted-foreground">Created <CompanyDate value={company.created_at} /></p><div className="mt-4 border-t pt-2"><CompanyActions {...props} company={company} /></div></article>)}</div>;
}
