"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { InventoryMovement, InventoryRecord } from "@/types/inventory";
import { formatDateTime } from "@/utils/date";
import { formatQuantity, MovementQuantity } from "../quantity";

export const TRANSACTION_LABELS = { po_receive_in: "Supplier receipt", dispatch_out: "Material dispatch", receive_in: "Hub receipt" };

export function MovementDetailsDialog({ movement, inventory, onClose }: { movement: InventoryMovement; inventory: InventoryRecord; onClose: () => void }) {
  const unit = `${inventory.product.base_unit.name} (${inventory.product.base_unit.symbol})`;
  const details = [
    ["Brand / Variant", `${inventory.product.brand.name} / ${inventory.product.variant.name}`], ["Product type", inventory.product.product_type.name],
    ["Unit of Measure", unit],
    ["Facility", `${inventory.facility.name} · ${inventory.company.name}`], ["Transaction", TRANSACTION_LABELS[movement.type]],
    ["Date & Time", formatDateTime(movement.created_at)], ["Processed By", movement.created_by_name ?? "Unknown user"],
    ["Balance Before", movement.balance_before === null ? "Unavailable for this historical record" : `${formatQuantity(movement.balance_before)} ${unit}`],
    ["Balance After", movement.balance_after === null ? "Unavailable for this historical record" : `${formatQuantity(movement.balance_after)} ${unit}`],
    ["Remarks / Reason", movement.remarks || "No remarks recorded"],
  ];
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>{movement.reference_no}</DialogTitle><DialogDescription>Stock movement details</DialogDescription></DialogHeader>
    <div className="text-2xl font-semibold"><MovementQuantity value={`${movement.direction === "out" ? "-" : ""}${movement.qty}`} unit={unit} /></div>
    <dl className="space-y-3">{details.map(([label, value]) => <div key={label} className="grid gap-1 text-sm sm:grid-cols-[140px_1fr]"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{value}</dd></div>)}</dl>
    {movement.source_href && <Button asChild variant="outline"><Link href={movement.source_href}>View source transaction</Link></Button>}
  </DialogContent></Dialog>;
}
