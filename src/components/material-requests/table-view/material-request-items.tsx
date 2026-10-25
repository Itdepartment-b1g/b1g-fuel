"use client";

import { useState } from "react";
import { TableView, type TableColumn } from "@/components/common/table/table-view";
import { Pagination } from "@/components/common/pagination";
import type { ListView } from "@/components/common/filter/search-filter-bar";
import type { RequestItem } from "@/types/material-requests";
import { paginateItems } from "@/utils/pagination";

const PAGE_SIZES = [10, 25, 50] as const;
const columns: TableColumn<RequestItem>[] = [
  { id: "product", header: "Material", value: (item) => item.product_label },
  { id: "unit", header: "Unit", value: (item) => item.unit_label },
  { id: "requested", header: "Requested", value: (item) => item.requested_qty },
  { id: "approved", header: "Approved", value: (item) => item.approved_qty ?? "—" },
];
const fittedColumns: TableColumn<RequestItem>[] = [
  { ...columns[0], className: "w-[46%]" },
  { ...columns[1], className: "w-[14%]" },
  { ...columns[2], className: "w-[20%]" },
  { ...columns[3], className: "w-[20%]" },
];

export function MaterialRequestItems({ items, view = "table", fit = false }: { items: RequestItem[]; view?: ListView; fit?: boolean }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const paginated = paginateItems(items, page, limit);
  return <section className="min-w-0 overflow-hidden rounded-xl border bg-muted/30">
    <div className="flex items-center justify-between gap-3 px-4 py-3"><h3 className="font-semibold">Requested materials</h3><p className="text-sm text-muted-foreground">{items.length} {items.length === 1 ? "line" : "lines"}</p></div>
    {view === "table" ? <TableView data={paginated.items} rowKey={(item) => item.id} caption="Requested materials" sortingMode="server" fit={fit} columns={fit ? fittedColumns : columns} emptyDescription="No materials yet." /> :
      <div className="grid gap-4 bg-card p-4 sm:grid-cols-2">
        {paginated.items.map((item) => <article key={item.id} className="rounded-xl border p-4">
          <h4 className="font-semibold break-words">{item.product_label}</h4><p className="mt-1 text-sm text-muted-foreground">{item.unit_label}</p>
          <dl className="mt-3 space-y-1 text-sm"><div className="flex justify-between gap-3"><dt>Requested</dt><dd>{item.requested_qty}</dd></div><div className="flex justify-between gap-3"><dt>Approved</dt><dd>{item.approved_qty ?? "—"}</dd></div></dl>
        </article>)}
        {!items.length && <p className="text-sm text-muted-foreground">No materials yet.</p>}
      </div>}
    {items.length > 0 && <Pagination className="border-t bg-card px-4" metadata={paginated} limitOptions={PAGE_SIZES}
      onPrev={() => setPage(paginated.page - 1)} onNext={() => setPage(paginated.page + 1)} onPage={setPage}
      onLimitChange={(size) => { setLimit(size); setPage(1); }} />}
  </section>;
}
