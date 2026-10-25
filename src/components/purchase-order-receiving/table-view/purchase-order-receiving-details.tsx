"use client";

import { useState } from "react";
import { Pagination } from "@/components/common/pagination";
import { TableView, type TableColumn } from "@/components/common/table/table-view";
import type { ReceivingLine, ReceivingSummary } from "@/types/receiving";
import { formatDateTime } from "@/utils/date";
import { PAGE_SIZE_OPTIONS, paginateItems } from "@/utils/pagination";

const columns: TableColumn<ReceivingLine>[] = [
  { id: "material", header: "Material", value: (line) => line.display_name },
  { id: "unit", header: "Unit", value: (line) => line.unit.symbol },
  { id: "qty", header: "This receipt", value: (line) => line.qty },
  { id: "ordered", header: "Ordered", value: (line) => line.ordered_qty },
  { id: "received", header: "Received", value: (line) => line.received_qty },
  { id: "outstanding", header: "Outstanding", value: (line) => line.outstanding_qty },
];

export function PurchaseOrderReceivingDetails({ receipt }: { receipt: ReceivingSummary }) {
  return <div className="min-w-0 space-y-4">
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="text-muted-foreground">Receiving no.</dt><dd className="mt-1 font-medium break-words">{receipt.receiving_no ?? "Draft"}</dd></div>
      <div><dt className="text-muted-foreground">Purchase order status</dt><dd className="mt-1 font-medium capitalize">{receipt.purchase_order_status.replaceAll("_", " ")}</dd></div>
      <div><dt className="text-muted-foreground">Created by</dt><dd className="mt-1 font-medium">{receipt.created_by_name || "—"}</dd></div>
      <div><dt className="text-muted-foreground">Created at</dt><dd className="mt-1 font-medium">{formatDateTime(receipt.created_at)}</dd></div>
      <div><dt className="text-muted-foreground">Posted by</dt><dd className="mt-1 font-medium">{receipt.posted_by_name || "—"}</dd></div>
      <div><dt className="text-muted-foreground">Posted at</dt><dd className="mt-1 font-medium">{formatDateTime(receipt.posted_at)}</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted-foreground">Warehouse address</dt><dd className="mt-1 font-medium break-words">{receipt.facility.address || "—"}</dd></div>
      <div className="sm:col-span-2 lg:col-span-4"><dt className="text-muted-foreground">Notes</dt><dd className="mt-1 font-medium whitespace-pre-wrap break-words">{receipt.notes || "—"}</dd></div>
    </dl>
    <ReceiptLines lines={receipt.items} />
  </div>;
}

function ReceiptLines({ lines }: { lines: ReceivingLine[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const paginated = paginateItems(lines, page, pageSize);
  return <div className="overflow-hidden rounded-lg border bg-white">
    <TableView data={paginated.items} rowKey={(line) => line.id} caption="Receipt lines" sortingMode="server" columns={columns} emptyTitle="No lines yet" emptyDescription="This receipt has no products." />
    {lines.length > 0 && <Pagination className="border-t px-4" metadata={paginated} limitOptions={PAGE_SIZE_OPTIONS} onPrev={() => setPage(paginated.page - 1)} onNext={() => setPage(paginated.page + 1)} onPage={setPage} onLimitChange={(size) => { setPageSize(size); setPage(1); }} />}
  </div>;
}
