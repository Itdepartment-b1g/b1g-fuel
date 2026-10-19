"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { Pagination } from "@/components/common/pagination";
import { TableView, type TableColumn } from "@/components/common/table/table-view";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearCompanySupplyMutation, createCompanySupply, getCompanySupplyOption, listCompanySupply, selectCompanySupply, updateCompanySupply } from "@/lib/store/company-supply-slice";
import type { CompanyOption } from "@/types/companies";
import type { CompanySupplyRelationship, SupplyDirection, SupplyStatus } from "@/types/company-supply";
import { formatDateTime } from "@/utils/date";
import { paginationFromApi } from "@/utils/pagination";

export function CompanySupplyLinksDialog({ company, onClose }: { company: CompanyOption; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const toast = useToast();
  const state = useAppSelector(selectCompanySupply);
  const [direction, setDirection] = useState<SupplyDirection>("requesting");
  const [status, setStatus] = useState<SupplyStatus>("all");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [confirming, setConfirming] = useState<CompanySupplyRelationship | null>(null);
  const busy = useRef(false);
  const pending = state.mutationStatus === "loading";
  const allowed = Boolean(access?.superAdmin);
  const current = state.listQuery?.company_id === company.id && state.listQuery.direction === direction &&
    state.listQuery.page === page && state.listQuery.search === search && state.listQuery.status === status;
  const result = current && state.listStatus === "succeeded" ? state.page : null;
  const error = current ? state.listError : null;

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const request = dispatch(listCompanySupply({ company_id: company.id, direction, status, search, page, page_size: 10 }));
    request.then((action) => {
      if (active && listCompanySupply.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => { active = false; request.abort(); };
  }, [dispatch, allowed, company.id, direction, status, search, page, revision]);
  useEffect(() => {
    if ([state.listError, state.optionsError, state.mutationError].some((failure) => failure?.status === 401)) router.replace("/login");
  }, [state.listError, state.optionsError, state.mutationError, router]);

  async function setActive(link: CompanySupplyRelationship, active: boolean) {
    if (pending || busy.current) return;
    busy.current = true;
    try {
      await dispatch(updateCompanySupply({ id: link.id, is_active: active })).unwrap();
      toast.success(active ? "Supply link activated." : "Supply link deactivated.");
      setConfirming(null);
      setRevision((value) => value + 1);
    } catch (failure) { toast.error(toastErrorMessage(failure, "Could not update the supply link.")); }
    finally { busy.current = false; }
  }
  const columns: TableColumn<CompanySupplyRelationship>[] = [
    { id: "company", header: direction === "requesting" ? "Supplier" : "Requesting company", value: (link) => direction === "requesting" ? link.supplying_company.name : link.requesting_company.name, className: "font-medium" },
    { id: "status", header: "Status", cell: (link) => <span className={link.is_active ? "text-emerald-700" : "text-muted-foreground"}>{link.is_active ? "Active" : "Inactive"}</span> },
    { id: "created_by", header: "Linked by", cell: (link) => link.created_by_name ?? "Unavailable" },
    { id: "created_at", header: "Linked at", cell: (link) => <time dateTime={link.created_at}>{formatDateTime(link.created_at)}</time> },
  ];
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] overflow-y-auto sm:max-w-4xl ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Supply links · {company.name}</DialogTitle><DialogDescription>Choose which companies can supply materials to each other. Links apply in the selected direction.</DialogDescription></DialogHeader>
        {!allowed ? <p role="status" className="text-sm text-muted-foreground">Only Super Admin can manage company supply links.</p> : <>
          <div role="group" aria-label="Supply relationship direction" className="flex flex-wrap gap-2">
            {([["requesting", "Suppliers"], ["supplying", "Requesting companies"]] as const).map(([value, label]) => <Button key={value} type="button" variant={direction === value ? "default" : "outline"} aria-pressed={direction === value} disabled={pending} onClick={() => {
              setDirection(value); setPage(1); setDraft(""); setSearch(""); setStatus("all"); setConfirming(null); dispatch(clearCompanySupplyMutation());
            }}>{label}</Button>)}
          </div>
          <p className="text-sm text-muted-foreground">{direction === "requesting"
            ? `${company.name} can request materials from the active suppliers below.`
            : `The companies below can request materials from ${company.name} when their links are active.`}</p>
          <CreateCompanySupplyFields key={`${company.id}-${direction}`} company={company} direction={direction} revision={revision}
            onSaved={() => { setPage(1); setRevision((value) => value + 1); }} />
          <section className="space-y-3 border-t pt-4" aria-label="Existing supply links">
            <h2 className="text-sm font-semibold">Existing links</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <form onSubmit={(event) => { event.preventDefault(); setSearch(draft.trim()); setPage(1); }} className="flex min-w-0 flex-1 gap-2">
                <Input type="search" aria-label="Search linked companies" placeholder="Search linked company name" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={160} disabled={pending} />
                <Button type="submit" variant="outline" disabled={pending}>Search</Button>
                {search && <Button type="button" variant="ghost" disabled={pending} onClick={() => { setDraft(""); setSearch(""); setPage(1); }}>Clear</Button>}
              </form>
              <label className="flex items-center gap-2 text-sm">Status
                <select aria-label="Supply link status" value={status} onChange={(event) => { setStatus(event.target.value as SupplyStatus); setPage(1); }} disabled={pending} className="h-10 rounded-md border bg-white px-3">
                  <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            {error ? <div role="alert" className="flex items-center gap-2 text-sm text-destructive"><span>{error.message}</span><Button size="sm" variant="outline" disabled={pending} onClick={() => setRevision((value) => value + 1)}>Try again</Button></div> : (
              <TableView data={result?.relationships ?? []} columns={columns} rowKey={(link) => link.id} caption="Company supply links" loading={!result} sortingMode="server"
                actionsDisabled={pending} emptyTitle="No supply links" emptyDescription="Link a company above or change your filters."
                actions={(link) => [{ id: "status", label: link.is_active ? "Deactivate" : "Activate", destructive: link.is_active,
                  onSelect: () => { dispatch(clearCompanySupplyMutation()); if (link.is_active) setConfirming(link); else void setActive(link, true); } }]} />
            )}
            {confirming && <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
              <p className="text-sm">Deactivate the link from {confirming.requesting_company.name} to {confirming.supplying_company.name}? Existing records will be kept.</p>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirming(null)}>Cancel</Button>
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => { void setActive(confirming, false); }}>Confirm deactivation</Button></div>
            </div>}
            {state.mutationError && <p role="alert" className="text-sm text-destructive">{state.mutationError.message}</p>}
            {result && result.total > 0 && <Pagination metadata={paginationFromApi(result)} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} onPage={setPage} disabled={pending} />}
          </section>
        </>}
        <div className="flex justify-end border-t pt-4"><Button variant="outline" disabled={pending} onClick={onClose}>Done</Button></div>
      </DialogContent>
    </Dialog>
  );
}

export function CreateCompanySupplyFields({ company, direction, revision, onSaved }: { company: CompanyOption; direction: SupplyDirection; revision: number; onSaved: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const state = useAppSelector(selectCompanySupply);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const busy = useRef(false);
  const pending = state.mutationStatus === "loading";
  const current = state.optionsQuery?.company_id === company.id && state.optionsQuery.direction === direction &&
    state.optionsQuery.page === page && state.optionsQuery.search === search;
  const options = current && state.optionsStatus === "succeeded" ? state.options : null;
  const error = current ? state.optionsError : null;
  const chosen = options?.companies.find((choice) => choice.id === selected);
  useEffect(() => {
    let active = true;
    const request = dispatch(getCompanySupplyOption({ company_id: company.id, direction, search, page, page_size: 10 }));
    request.then((action) => {
      if (active && getCompanySupplyOption.fulfilled.match(action)) {
        const valid = paginationFromApi(action.payload).page;
        if (valid !== page) setPage(valid);
      }
    });
    return () => { active = false; request.abort(); };
  }, [dispatch, company.id, direction, search, page, revision]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen || pending || busy.current) return;
    busy.current = true;
    try {
      const { relationship } = await dispatch(createCompanySupply(direction === "requesting"
        ? { requesting_company_id: company.id, supplying_company_id: chosen.id }
        : { requesting_company_id: chosen.id, supplying_company_id: company.id })).unwrap();
      toast.success(`${relationship.requesting_company.name} was linked to ${relationship.supplying_company.name}.`);
      setSelected(""); setPage(1); onSaved();
    } catch (failure) { toast.error(toastErrorMessage(failure, "Could not create the supply link.")); }
    finally { busy.current = false; }
  }
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="Create a supply link">
      <h2 className="text-sm font-semibold">{direction === "requesting" ? "Link a supplier" : "Link a requesting company"}</h2>
      <form onSubmit={(event) => { event.preventDefault(); setSearch(draft.trim()); setPage(1); setSelected(""); }} className="flex gap-2">
        <Input type="search" aria-label="Search companies to link" placeholder="Search company name" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={160} disabled={pending} />
        <Button type="submit" variant="outline" disabled={pending}>Search</Button>
        {search && <Button type="button" variant="ghost" disabled={pending} onClick={() => { setDraft(""); setSearch(""); setPage(1); setSelected(""); }}>Clear</Button>}
      </form>
      {error ? <div><p role="alert" className="text-sm text-destructive">{error.message}</p>
        <Button type="button" variant="outline" size="sm" className="mt-2" disabled={pending} onClick={() => dispatch(getCompanySupplyOption({ company_id: company.id, direction, search, page, page_size: 10 }))}>Try again</Button>
      </div> : !options ? <Loading /> : options.companies.length ? <>
        <form onSubmit={save} className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end" aria-busy={pending}>
          <label className="min-w-0 flex-1 space-y-2 text-sm font-medium">{direction === "requesting" ? "Supplying company" : "Requesting company"}
            <select value={chosen ? selected : ""} onChange={(event) => setSelected(event.target.value)} required disabled={pending} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">Select a company</option>
              {options.companies.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
            </select>
          </label>
          <Button type="submit" disabled={pending || !chosen}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}Link company</Button>
        </form>
        {options.total > options.page_size && <Pagination metadata={paginationFromApi(options)} onPrev={() => { setPage(page - 1); setSelected(""); }} onNext={() => { setPage(page + 1); setSelected(""); }} onPage={(next) => { setPage(next); setSelected(""); }} disabled={pending} />}
      </> : <p role="status" className="text-sm text-muted-foreground">{search ? "No companies match your search." : "No unlinked companies are available. Existing inactive links can be activated below."}</p>}
    </section>
  );
}
