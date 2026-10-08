"use client";
import type { ReactNode } from "react";
import { CheckCircle2, LayoutGrid, List, LoaderCircle, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "./pagination";
import { PAGE_SIZE_OPTIONS, type PaginationMetadata } from "@/lib/pagination";

type Props = {
  title: string; description: string; action: ReactNode; total: number; children: ReactNode; toolbar?: ReactNode;
  searchDraft: string; onSearchDraft: (value: string) => void; onSearch: () => void; searchActive: boolean; onClearSearch: () => void; searchMaxLength: number;
  view: "table" | "cards"; onView: (view: "table" | "cards") => void;
  loading: boolean; error?: string | null; onRefresh: () => void; success?: string | null; onDismissSuccess: () => void;
  metadata: PaginationMetadata; onPage: (page: number) => void; onLimitChange: (limit: number) => void;
};
export function ManagementList(props: Props) {
  return <section className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</p><h1 className="text-3xl font-bold tracking-tight text-primary">{props.title}</h1><p className="mt-2 text-sm text-muted-foreground">{props.description}</p></div>{props.action}</header>
    {props.success && <div role="status" className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="size-5 shrink-0" aria-hidden="true" /><span className="flex-1">{props.success}</span><button type="button" aria-label="Dismiss success message" onClick={props.onDismissSuccess} className="rounded p-1"><X className="size-4" /></button></div>}
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-5 sm:px-6"><div className="flex items-center gap-2"><h2 className="font-semibold">All {props.title.toLowerCase()}</h2><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{props.total}</span></div><div className="flex gap-2"><Button variant="ghost" size="icon" aria-label={`Refresh ${props.title.toLowerCase()}`} disabled={props.loading} onClick={props.onRefresh}><RefreshCw className={`size-4 ${props.loading ? "animate-spin" : ""}`} /></Button><div className="flex rounded-lg border p-1" role="group" aria-label={`${props.title} display`}>{(["table", "cards"] as const).map(view => <button key={view} type="button" aria-label={view === "table" ? "Table view" : "Card view"} aria-pressed={props.view === view} onClick={() => props.onView(view)} className={`rounded-md p-2 ${props.view === view ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>{view === "table" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}</button>)}</div></div></div>
      <form aria-label={`Search ${props.title.toLowerCase()}`} onSubmit={event => { event.preventDefault(); props.onSearch(); }} className="flex flex-wrap items-center gap-2 border-b p-4 sm:px-6"><div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /><Input type="search" aria-label={`Search ${props.title.toLowerCase()}`} placeholder={`Search ${props.title.toLowerCase()}`} value={props.searchDraft} maxLength={props.searchMaxLength} onChange={event => props.onSearchDraft(event.target.value)} className="pl-9" /></div><Button variant="outline" type="submit">Search</Button>{props.searchActive && <Button variant="ghost" type="button" onClick={props.onClearSearch}>Clear</Button>}{props.toolbar}</form>
      {props.error && <div role="alert" className="flex items-center justify-between gap-3 border-b bg-red-50 px-6 py-3 text-sm text-destructive"><span>{props.error}</span><Button variant="outline" size="sm" onClick={props.onRefresh}>Try again</Button></div>}
      <div aria-busy={props.loading}>{props.children}</div>
      <Pagination metadata={props.metadata} disabled={props.loading} onPrev={() => props.onPage(props.metadata.page - 1)} onNext={() => props.onPage(props.metadata.page + 1)} onPage={props.onPage} onLimitChange={props.onLimitChange} limitOptions={PAGE_SIZE_OPTIONS} />
    </div>
  </section>;
}
export function ListPlaceholder({ loading, title, description }: { loading: boolean; title: string; description: string }) {
  return <div className="px-6 py-16 text-center">{loading ? <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Loading…</p> : <><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{description}</p></>}</div>;
}
