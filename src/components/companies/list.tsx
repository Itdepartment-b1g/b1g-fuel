"use client";
import type { TableSort } from "@/lib/table";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementList, ListPlaceholder } from "@/components/common/management-list";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { listCompany, deleteCompany, clearCompanyMutation, selectCompany } from "@/lib/store/companies-slice";
import { DEFAULT_PAGE_SIZE, paginationFromApi } from "@/lib/pagination";
import type { CompanySummary } from "@/server/schema/companies_schema";
import { CompanyDialog } from "./dialog";
import { CompaniesTable, CompaniesCards } from "./table";

export default function CompaniesList() {
  const dispatch = useAppDispatch(); const router = useRouter();
  const { companies, total, listStatus, listError, mutationStatus, mutationError } = useAppSelector(selectCompany);
  const [page, setPage] = useState(1); const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE); const [search, setSearch] = useState(""); const [draft, setDraft] = useState("");
  const [sorting, setSorting] = useState<TableSort | null>(null);
  const [view, setView] = useState<"table" | "cards">("table"); const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null); const [removing, setRemoving] = useState<CompanySummary | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const loading = listStatus === "loading" || listStatus === "idle"; const pending = mutationStatus === "loading"; const metadata = paginationFromApi({ page, page_size: limit, total });
  useEffect(() => {
    let current = true; const request = dispatch(listCompany({ page, page_size: limit, search, ...(sorting ? { sort_by: sorting.field, sort_order: sorting.direction } : {}) }));
    request.then(action => { if (current && listCompany.fulfilled.match(action)) { const valid = paginationFromApi(action.payload).page; if (valid !== page) setPage(valid); } });
    return () => { current = false; request.abort(); };
  }, [dispatch, page, limit, search, revision, sorting]);
  useEffect(() => { if ([listError, mutationError].some(error => error?.status === 401)) router.replace("/login"); }, [listError, mutationError, router]);
  function openCompany(company?: CompanySummary) { dispatch(clearCompanyMutation()); setEditor({ id: company?.id ?? null }); }
  async function removeCompany() { if (!removing) return; try { await dispatch(deleteCompany(removing.id)).unwrap(); setSuccess(`${removing.name} was deleted.`); setRemoving(null); setRevision(value => value + 1); } catch { /* Keep the dialog open with the server error. */ } }
  if (listError?.status === 403) return <section className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Access restricted</h1><p className="mt-2 text-muted-foreground">Company management is available to super-admins.</p></section>;
  const actions = { companies, sorting, loading, onSortingChange: (next: TableSort | null) => { setSorting(next); setPage(1); }, disabled: pending || loading, onEdit: openCompany, onDelete: (company: CompanySummary) => { dispatch(clearCompanyMutation()); setRemoving(company); } };
  return <>
    <ManagementList title="Companies" description="Organize your companies and view their team memberships." total={total} action={<Button disabled={pending} onClick={() => openCompany()}><Plus className="size-4" aria-hidden="true" />Add company</Button>}
      searchDraft={draft} onSearchDraft={setDraft} searchMaxLength={160} onSearch={() => { setSearch(draft.trim()); setPage(1); }} searchActive={Boolean(search)} onClearSearch={() => { setDraft(""); setSearch(""); setPage(1); }}
      view={view} onView={setView} loading={loading} error={listError?.message} onRefresh={() => setRevision(value => value + 1)} success={success} onDismissSuccess={() => setSuccess(null)} metadata={metadata} onPage={setPage} onLimitChange={value => { setLimit(value); setPage(1); }}>
      {view === "table" ? <CompaniesTable {...actions} /> : !companies.length ? <ListPlaceholder loading={loading} title={search ? "No matching companies" : "No companies yet"} description={search ? "Try another company name." : "Add your first company to organize memberships."} /> : <CompaniesCards {...actions} />}
    </ManagementList>
    {editor && <CompanyDialog companyId={editor.id} onClose={() => setEditor(null)} onSaved={company => { setSuccess(`${company.name} was ${editor.id ? "updated" : "created"} successfully.`); if (!editor.id) setPage(1); setEditor(null); setRevision(value => value + 1); }} />}
    <DeleteDialog open={Boolean(removing)} onOpenChange={open => { if (!open) setRemoving(null); }} title="Delete company?" description={`Delete ${removing?.name ?? "this company"}? Only companies without members can be deleted. This cannot be undone.`} onConfirm={() => { void removeCompany(); }} pending={pending} error={mutationError?.message} />
  </>;
}
