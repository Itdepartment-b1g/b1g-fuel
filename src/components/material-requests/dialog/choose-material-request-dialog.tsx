"use client";

import { Building2, Warehouse } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/providers/toast-provider";

export function ChooseMaterialRequestDialog({ onClose, onWarehouse }: { onClose: () => void; onWarehouse: () => void }) {
  const toast = useToast();
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-x-hidden overflow-y-auto sm:max-w-lg [&>*]:min-w-0">
      <DialogHeader>
        <DialogTitle>Where should the materials come from?</DialogTitle>
        <DialogDescription>Choose a source before you create the request.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3" role="group" aria-label="Where to request materials">
        <button type="button" className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-left hover:bg-sky-100" onClick={onWarehouse}>
          <Warehouse className="mt-0.5 size-5 shrink-0 text-sky-600" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-medium text-sky-800">Warehouse</span>
            <span className="mt-1 block text-sm text-sky-900/80">Request materials from a linked supplying company's warehouse.</span>
          </span>
        </button>
        <button type="button" className="flex items-start gap-3 rounded-xl border bg-white p-4 text-left hover:bg-slate-50" onClick={() => toast.info("Coming soon.")}>
          <Building2 className="mt-0.5 size-5 shrink-0 text-violet-600" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-medium">Other hub</span>
            <span className="mt-1 block text-sm text-muted-foreground">Request materials from another hub in your company.</span>
          </span>
        </button>
        <button type="button" className="flex items-start gap-3 rounded-xl border bg-white p-4 text-left hover:bg-slate-50" onClick={() => toast.info("Coming soon.")}>
          <Building2 className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-medium">Other company</span>
            <span className="mt-1 block text-sm text-muted-foreground">Request materials from a hub that belongs to another company.</span>
          </span>
        </button>
      </div>
    </DialogContent>
  </Dialog>;
}
