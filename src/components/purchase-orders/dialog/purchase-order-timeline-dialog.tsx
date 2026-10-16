"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, ClipboardList, FilePlus, Hourglass, PackageCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { Pagination } from "@/components/common/pagination";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editPurchaseOrder, selectPurchaseOrder } from "@/lib/store/purchase-orders-slice";
import { paginationFromApi } from "@/utils/pagination";
import {
  PURCHASE_ORDER_STATUS_LABEL,
  type PaymentMethod,
  type PurchaseOrderEvent,
  type PurchaseOrderSummary,
} from "@/types/purchase-orders";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  check: "Check",
};

const PAGE_SIZES = [10, 25, 50] as const;

const EVENT_ICON: Record<PurchaseOrderEvent["kind"], LucideIcon> = {
  created: FilePlus,
  confirmed: Hourglass,
  receipt_posted: PackageCheck,
  closed: CircleCheck,
};

const EVENT_LEGEND: { kind: PurchaseOrderEvent["kind"]; label: string; swatch: string; mark: string }[] = [
  { kind: "created", label: "Order created", swatch: "bg-sky-500", mark: "border-sky-300 bg-sky-50 text-sky-700" },
  { kind: "confirmed", label: "Awaiting receipt", swatch: "bg-amber-500", mark: "border-amber-300 bg-amber-50 text-amber-700" },
  { kind: "receipt_posted", label: "Order received", swatch: "bg-emerald-500", mark: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { kind: "closed", label: "Order closed", swatch: "bg-slate-500", mark: "border-slate-300 bg-slate-100 text-slate-700" },
];

function EventMark({ kind }: { kind: PurchaseOrderEvent["kind"] }) {
  const Icon = EVENT_ICON[kind];
  const color = EVENT_LEGEND.find((item) => item.kind === kind)?.mark ?? "";
  return (
    <span className={`absolute -left-[38px] top-0 flex size-7 items-center justify-center rounded-full border bg-card ${color}`}>
      <Icon className="size-3.5" aria-hidden="true" />
    </span>
  );
}

function eventTitle(event: PurchaseOrderEvent) {
  if (event.kind === "created") return "Order created";
  if (event.kind === "confirmed") return "Awaiting receipt";
  if (event.kind === "receipt_posted") return "Order received";
  return "Order closed";
}

function when(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function qtyLabel(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words">{value || "—"}</dd>
    </div>
  );
}

type TimelineRow = {
  id: string;
  brand: string;
  variant: string;
  unit: string;
  type: string;
  ordered: number;
  received: number;
};

function timelineRows(order: PurchaseOrderSummary, received: Map<string, number>): TimelineRow[] {
  return order.items.map((line) => ({
    id: line.id,
    brand: line.brand.name,
    variant: line.variant.name,
    unit: line.unit.symbol,
    type: line.product_type.name,
    ordered: Number(line.ordered_qty),
    received: received.get(line.id) ?? 0,
  }));
}

function receivedAfterEachStep(order: PurchaseOrderSummary) {
  const running = new Map(order.items.map((line) => [line.id, 0]));
  const byEvent = new Map<string, Map<string, number>>();
  for (const event of order.events) {
    if (event.kind === "receipt_posted") {
      for (const line of event.lines) {
        const lineId = line.purchase_order_item_id
          || order.items.find((item) => item.display_name === line.display_name)?.id;
        if (!lineId) continue;
        running.set(lineId, (running.get(lineId) ?? 0) + Number(line.qty));
      }
    }
    byEvent.set(event.id, new Map(running));
  }
  return byEvent;
}

function OrderDetails({ order }: { order: PurchaseOrderSummary }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
      <Field label="Supplier" value={order.supplier.name} />
      <Field label="Warehouse" value={order.location.name} />
      <Field label="Address" value={order.location.address} />
      <Field label="Company" value={order.company.name} />
      <Field label="Payment terms" value={order.payment_terms} />
      <Field label="Payment method" value={order.payment_method ? PAYMENT_LABEL[order.payment_method] : "—"} />
      <Field label="Expected delivery" value={order.estimated_delivery_on ?? "—"} />
      <Field label="Created by" value={order.created_by_name ?? "—"} />
      <Field label="Notes" value={order.notes} />
      <div>
        <dt className="text-xs text-muted-foreground">Status</dt>
        <dd className="mt-1 text-sm font-semibold">{PURCHASE_ORDER_STATUS_LABEL.draft}</dd>
      </div>
    </dl>
  );
}

function pendingQty(line: TimelineRow) {
  return Number.isFinite(line.ordered) && Number.isFinite(line.received) ? Math.max(0, line.ordered - line.received) : 0;
}

function LineTable({ title, rows, view }: { title: string; rows: TimelineRow[]; view: "table" | "cards" }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const start = (page - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);
  const ordered = rows.reduce((sum, line) => sum + (Number.isFinite(line.ordered) ? line.ordered : 0), 0);
  const received = rows.reduce((sum, line) => sum + (Number.isFinite(line.received) ? line.received : 0), 0);
  const pagination = paginationFromApi({ page, page_size: pageSize, total: rows.length });

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border bg-muted/30">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "line" : "lines"} · {qtyLabel(received)} of {qtyLabel(ordered)}
          </p>
        </div>
        {view === "table" ? (
          <div className="overflow-x-auto bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-y text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Variant</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Total Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Received</th>
                  <th className="px-4 py-3 text-right font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-semibold">{line.brand}</td>
                    <td className="px-4 py-3">{line.variant} ({line.unit})</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">{line.type}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{Number.isFinite(line.ordered) ? qtyLabel(line.ordered) : "—"}</td>
                    <td className="px-4 py-3 text-right">{Number.isFinite(line.received) ? qtyLabel(line.received) : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{qtyLabel(pendingQty(line))}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-muted-foreground">No lines yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 bg-card p-4 sm:grid-cols-2">
            {visible.map((line) => (
              <article key={line.id} className="rounded-xl border p-4">
                <h4 className="font-semibold">{line.brand}</h4>
                <p className="mt-1 text-sm">{line.variant} ({line.unit})</p>
                <span className="mt-2 inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">{line.type}</span>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Total Qty</dt><dd>{Number.isFinite(line.ordered) ? qtyLabel(line.ordered) : "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Received</dt><dd>{Number.isFinite(line.received) ? qtyLabel(line.received) : "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Remaining</dt><dd className="font-semibold">{qtyLabel(pendingQty(line))}</dd></div>
                </dl>
              </article>
            ))}
            {!rows.length && <p className="text-sm text-muted-foreground">No lines yet.</p>}
          </div>
        )}
        {rows.length > 0 && (
          <Pagination
            className="border-t bg-card px-4"
            metadata={pagination}
            limitOptions={PAGE_SIZES}
            onPrev={() => setPage((current) => current - 1)}
            onNext={() => setPage((current) => current + 1)}
            onPage={setPage}
            onLimitChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </section>
    </div>
  );
}

export function PurchaseOrderTimelineDialog({
  purchaseOrderId,
  onClose,
}: {
  purchaseOrderId: string;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedPurchaseOrder, detailStatus, detailError } = useAppSelector(selectPurchaseOrder);
  const order = selectedPurchaseOrder?.id === purchaseOrderId ? selectedPurchaseOrder : null;
  const stepCount = order ? 1 + order.events.filter((event) => event.kind !== "created").length : 0;
  const receivedByStep = order ? receivedAfterEachStep(order) : new Map<string, Map<string, number>>();
  const [view, setView] = useState<"table" | "cards">("table");

  useEffect(() => {
    const request = dispatch(editPurchaseOrder(purchaseOrderId));
    return () => request.abort();
  }, [dispatch, purchaseOrderId]);

  useEffect(() => {
    if (detailError?.status === 401) router.replace("/login");
  }, [detailError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" aria-hidden="true" />
            Order timeline
            {order && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {stepCount} {stepCount === 1 ? "event" : "events"}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {order ? `${order.purchase_order_no} · ${order.supplier.name} · ${order.location.name}` : "Purchase order history"}
          </DialogDescription>
        </DialogHeader>
        {detailStatus === "loading" || !order ? (
          detailError ? (
            <div>
              <p role="alert" className="text-sm text-destructive">{detailError.message}</p>
              <Button variant="outline" className="mt-3" onClick={() => dispatch(editPurchaseOrder(purchaseOrderId))}>
                Try again
              </Button>
            </div>
          ) : (
            <Loading />
          )
        ) : (
          <div className="space-y-6">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Event colors">
            {EVENT_LEGEND.map((item) => (
              <li key={item.kind} className="inline-flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${item.swatch}`} aria-hidden="true" />
                {item.label}
              </li>
            ))}
          </ul>
          <div role="tablist" aria-label="Line display" className="flex w-fit rounded-lg border p-1">
            <button type="button" role="tab" aria-selected={view === "table"} onClick={() => setView("table")} className={`rounded-md px-3 py-1.5 text-sm ${view === "table" ? "bg-gray-50 font-medium" : "text-muted-foreground"}`}>
              Table
            </button>
            <button type="button" role="tab" aria-selected={view === "cards"} onClick={() => setView("cards")} className={`rounded-md px-3 py-1.5 text-sm ${view === "cards" ? "bg-gray-50 font-medium" : "text-muted-foreground"}`}>
              Card view
            </button>
          </div>
          <ol className="space-y-8 border-l border-border pl-6">
            <li className="relative">
              <EventMark kind="created" />
              <p className="font-semibold">Order created</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {when(order.events.find((event) => event.kind === "created")?.created_at ?? order.created_at)}
              </p>
              <div className="mt-4 space-y-5">
                <OrderDetails order={order} />
                <LineTable
                  key={`${order.id}-created`}
                  title={order.supplier.name}
                  view={view}
                  rows={timelineRows(order, new Map())}
                />
              </div>
            </li>
            {order.events.filter((event) => event.kind !== "created").map((event) => {
              const heading = event.receiving_no ? `${eventTitle(event)} · ${event.receiving_no}` : eventTitle(event);
              return (
                <li key={event.id} className="relative">
                  <EventMark kind={event.kind} />
                  <p className="font-semibold">{heading}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{when(event.created_at)}</p>
                  <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
                    <Field
                      label="Received at"
                      value={event.kind === "receipt_posted" ? when(event.created_at) : "—"}
                    />
                    <Field
                      label="Received by"
                      value={event.kind === "receipt_posted" ? (event.created_by_name ?? "—") : "—"}
                    />
                    <div>
                      <dt className="text-xs text-muted-foreground">Status</dt>
                      <dd className="mt-1 text-sm font-semibold">{PURCHASE_ORDER_STATUS_LABEL[event.status]}</dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <LineTable
                      title={order.supplier.name}
                      view={view}
                      rows={timelineRows(order, receivedByStep.get(event.id) ?? new Map())}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
