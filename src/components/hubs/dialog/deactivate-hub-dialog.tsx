"use client";

import { LoaderCircle, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { HubSummary } from "@/types/hubs";

export function DeactivateHubDialog({ hub, pending, error, onClose, onConfirm }: {
  hub: HubSummary; pending: boolean; error?: string; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className={pending ? "[&>button]:hidden" : ""}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Deactivate hub?</DialogTitle>
          <DialogDescription>Deactivate {hub.name}? Its records and staff assignments will be kept. You can reactivate it from Edit hub.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Power className="size-4" />}{pending ? "Deactivating..." : "Deactivate hub"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
