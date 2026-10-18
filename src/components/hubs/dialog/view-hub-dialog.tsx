"use client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { HubSummary } from "@/types/hubs";
import { HubDetails } from "../hub-details";

export function ViewHubDialog({ hub, onClose }: { hub: HubSummary; onClose: () => void }) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>{hub.name}</DialogTitle><DialogDescription>Hub details and staff summary.</DialogDescription></DialogHeader>
    <HubDetails hub={hub} />
  </DialogContent></Dialog>;
}
