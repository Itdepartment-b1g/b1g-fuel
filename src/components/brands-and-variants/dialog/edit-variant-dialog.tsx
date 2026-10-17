"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editVariant, selectVariant, updateVariant } from "@/lib/store/variants-slice";
import type { VariantSummary } from "@/types/variants";

export function EditVariantDialog({
  variantId,
  onClose,
  onSaved,
}: {
  variantId: string;
  onClose: () => void;
  onSaved: (variant: VariantSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedVariant, detailStatus, detailError, mutationStatus, mutationError } = useAppSelector(selectVariant);
  const pending = mutationStatus === "loading";
  const variant = selectedVariant?.id === variantId ? selectedVariant : null;
  const ready = detailStatus === "succeeded" && variant;

  useEffect(() => {
    const request = dispatch(editVariant(variantId));
    return () => request.abort();
  }, [dispatch, variantId]);

  useEffect(() => {
    if ([detailError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [detailError, mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-lg ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Edit variant</DialogTitle>
          <DialogDescription>Update the variant name.</DialogDescription>
        </DialogHeader>
        {ready && variant ? (
          <EditVariantFields variant={variant} onCancel={onClose} onSaved={onSaved} />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{detailError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(editVariant(variantId))}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditVariantFields({
  variant,
  onSaved,
  onCancel,
}: {
  variant: VariantSummary;
  onSaved: (variant: VariantSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { mutationStatus, mutationError } = useAppSelector(selectVariant);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState(variant.name);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a variant name.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(updateVariant({ id: variant.id, name: name.trim() })).unwrap();
      toast.success(`${result.variant.name} was updated successfully.`);
      onSaved(result.variant);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the variant."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <label className="space-y-2 text-sm font-medium">
          Variant name
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Diesel" required maxLength={160} />
        </label>
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
