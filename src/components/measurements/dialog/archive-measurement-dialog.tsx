import { Archive, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ArchiveMeasurementDialog({ name, pending, error, onClose, onConfirm }: {
  name: string; pending: boolean; error: string | null; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className={`w-[calc(100%_-_2rem)] ${pending ? "[&>button]:hidden" : ""}`} onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Archive measurement?</DialogTitle><DialogDescription>Archive {name}? Its fields and units will be preserved. You can restore it later.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}{pending ? "Archiving…" : "Archive"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
