"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  closePurchaseOrder,
  confirmPurchaseOrder,
  editPurchaseOrder,
  getPurchaseOrderOption,
  selectPurchaseOrder,
  updatePurchaseOrder,
} from "@/lib/store/purchase-orders-slice";
import type { PurchaseOrderSummary } from "@/types/purchase-orders";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "gcash", label: "GCash" },
  { value: "check", label: "Check" },
];

type DraftLine = {
  key: string;
  variant_id: string;
  product_type_id: string;
  base_unit_id: string;
  ordered_qty: string;
};

function blankLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    variant_id: "",
    product_type_id: "",
    base_unit_id: "",
    ordered_qty: "",
  };
}

function forCompany<T extends { company_id: string | null }>(rows: T[], companyId: string) {
  return rows.filter((row) => !row.company_id || row.company_id === companyId);
}

export function EditPurchaseOrderDialog({
  purchaseOrderId,
  onClose,
  onSaved,
}: {
  purchaseOrderId: string;
  onClose: () => void;
  onSaved: (order: PurchaseOrderSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    selectedPurchaseOrder,
    detailStatus,
    detailError,
    optionsStatus,
    optionsError,
    mutationStatus,
    mutationError,
  } = useAppSelector(selectPurchaseOrder);
  const pending = mutationStatus === "loading";
  const order =
    selectedPurchaseOrder?.id === purchaseOrderId ? selectedPurchaseOrder : null;
  const ready = optionsStatus === "succeeded" && detailStatus === "succeeded" && order;
  const error = optionsError ?? detailError;

  useEffect(() => {
    const options = dispatch(getPurchaseOrderOption());
    const detail = dispatch(editPurchaseOrder(purchaseOrderId));
    return () => {
      options.abort();
      detail.abort();
    };
  }, [dispatch, purchaseOrderId]);

  useEffect(() => {
    if ([detailError, optionsError, mutationError].some((failure) => failure?.status === 401))
      router.replace("/login");
  }, [detailError, optionsError, mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-4xl ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Purchase order</DialogTitle>
          <DialogDescription>
            Order from a supplier into the company's warehouse. Saving a line creates the product. Stock does not change until receiving.
          </DialogDescription>
        </DialogHeader>
        {ready && order ? (
          <EditPurchaseOrderFields order={order} onCancel={onClose} onSaved={onSaved} />
        ) : error ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{error.message}</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                dispatch(getPurchaseOrderOption());
                dispatch(editPurchaseOrder(purchaseOrderId));
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditPurchaseOrderFields({
  order,
  onSaved,
  onCancel,
}: {
  order: PurchaseOrderSummary;
  onSaved: (row: PurchaseOrderSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectPurchaseOrder);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const locked = order.status !== "draft";
  const [supplierId, setSupplierId] = useState(order.supplier_id);
  const [paymentTerms, setPaymentTerms] = useState(order.payment_terms);
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method ?? "");
  const [deliveryOn, setDeliveryOn] = useState(order.estimated_delivery_on ?? "");
  const [notes, setNotes] = useState(order.notes);
  const [lines, setLines] = useState<DraftLine[]>(
    order.items.length
      ? order.items.map((item) => ({
          key: item.id,
          variant_id: item.variant_id,
          product_type_id: item.product_type_id,
          base_unit_id: item.base_unit_id,
          ordered_qty: item.ordered_qty,
        }))
      : [blankLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const suppliers = forCompany(options.suppliers, order.company_id);
  const locations = options.locations.filter((location) => location.company_id === order.company_id);
  const warehouse = locations.length === 1 ? locations[0] : locations.length === 0 ? order.location : undefined;
  const variants = forCompany(options.variants, order.company_id);
  const productTypes = forCompany(options.product_types, order.company_id);

  function validate(confirming: boolean) {
    if (locations.length !== 1)
      return locations.length
        ? "This company has more than one warehouse."
        : "This company has no warehouse.";
    if (!supplierId) return "Select a supplier.";
    if (!lines.length) return "Add at least one line.";
    if (lines.some((line) => !line.variant_id || !line.product_type_id || !line.base_unit_id))
      return "Each line needs a variant, product type, and base unit.";
    if (lines.some((line) => !/^\d{1,9}(\.\d{1,3})?$/.test(line.ordered_qty.trim()) || Number(line.ordered_qty) <= 0))
      return "Enter an ordered quantity greater than 0.";
    const keys = lines.map((line) => `${line.variant_id}:${line.product_type_id}`);
    if (new Set(keys).size !== keys.length)
      return "Each variant and product type can appear once on an order.";
    if (confirming && !paymentTerms.trim())
      return "Enter payment terms before confirming the purchase order.";
    return null;
  }

  async function save(event: FormEvent, confirming = false) {
    event.preventDefault();
    if (busy.current || locked) return;
    const problem = validate(confirming);
    if (problem) {
      setError(problem);
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const saved = await dispatch(
        updatePurchaseOrder({
          id: order.id,
          company_id: order.company_id,
          supplier_id: supplierId,
          payment_terms: paymentTerms,
          payment_method: paymentMethod || null,
          estimated_delivery_on: deliveryOn || null,
          notes,
          lines: lines.map(({ variant_id, product_type_id, base_unit_id, ordered_qty }) => ({
            variant_id,
            product_type_id,
            base_unit_id,
            ordered_qty,
          })),
        }),
      ).unwrap();
      const confirmed = confirming
        ? await dispatch(confirmPurchaseOrder(order.id)).unwrap()
        : saved;
      toast.success(
        confirming
          ? "Purchase order confirmed. Stock is unchanged until receiving."
          : "Draft purchase order was updated.",
      );
      onSaved(confirmed.purchase_order);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the purchase order."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending || locked} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium">
            Supplier <span className="text-destructive">*</span>
            <select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              required
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
            >
              <option value="">Select a supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1 text-sm font-medium">
            Warehouse
            {warehouse ? (
              <>
                <span className="block font-normal">{warehouse.name}</span>
                <span className="block font-normal text-muted-foreground">
                  {warehouse.address.trim() || "No address"}
                </span>
              </>
            ) : (
              <span className="block font-normal text-muted-foreground">
                {locations.length > 1
                  ? "This company has more than one warehouse."
                  : "This company has no warehouse."}
              </span>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-2 text-sm font-medium">
            Payment terms
            <Input
              value={paymentTerms}
              onChange={(event) => setPaymentTerms(event.target.value)}
              placeholder="COD, Net 15, Net 30"
              maxLength={160}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Preferred payment
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
            >
              <option value="">None</option>
              {METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Expected delivery
            <Input
              type="date"
              value={deliveryOn}
              onChange={(event) => setDeliveryOn(event.target.value)}
            />
          </label>
        </div>
        <label className="block space-y-2 text-sm font-medium">
          Notes
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            placeholder="Optional note"
          />
        </label>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Lines</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((current) => [...current, blankLine()])}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add line
            </Button>
          </div>
          {lines.map((line, index) => (
            <div key={line.key} className="grid gap-3 rounded-md border p-3 sm:grid-cols-4">
              <label className="block space-y-2 text-sm font-medium">
                Variant
                <select
                  aria-label={`Variant ${index + 1}`}
                  value={line.variant_id}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item) =>
                        item.key === line.key ? { ...item, variant_id: event.target.value } : item,
                      ),
                    )
                  }
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                >
                  <option value="">Select</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.brand.name} · {variant.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Type
                <select
                  aria-label={`Product type ${index + 1}`}
                  value={line.product_type_id}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item) =>
                        item.key === line.key
                          ? { ...item, product_type_id: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                >
                  <option value="">Select</option>
                  {productTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Base unit
                <select
                  aria-label={`Base unit ${index + 1}`}
                  value={line.base_unit_id}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item) =>
                        item.key === line.key
                          ? { ...item, base_unit_id: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                >
                  <option value="">Select</option>
                  {options.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.symbol})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <label className="block min-w-0 flex-1 space-y-2 text-sm font-medium">
                  Qty
                  <Input
                    aria-label={`Ordered quantity ${index + 1}`}
                    value={line.ordered_qty}
                    inputMode="decimal"
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item) =>
                          item.key === line.key
                            ? { ...item, ordered_qty: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) => current.filter((item) => item.key !== line.key))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      {(error || mutationError) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? mutationError?.message}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          {locked ? "Done" : "Cancel"}
        </Button>
        {locked && (order.status === "awaiting_receipt" || order.status === "partially_received") && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              void dispatch(closePurchaseOrder(order.id))
                .unwrap()
                .then((result) => {
                  toast.success("Purchase order was closed.");
                  onSaved(result.purchase_order);
                })
                .catch((failure) => {
                  toast.error(toastErrorMessage(failure, "Could not close the purchase order."));
                })
                .finally(() => {
                  busy.current = false;
                });
            }}
          >
            Close order
          </Button>
        )}
        {!locked && (
          <>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Save draft
            </Button>
            <Button type="button" disabled={pending} onClick={(event) => void save(event, true)}>
              Confirm order
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
