"use client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { HubSummary } from "@/types/hubs";
import { HubDetails } from "../hub-details";
import { HubAssignedUsers } from "../hub-assigned-users";

export function ViewHubDialog({ hub, onClose, revision }: { hub: HubSummary; onClose: () => void; revision?: number }) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
    <DialogHeader><DialogTitle>{hub.name}</DialogTitle><DialogDescription>Hub details and staff summary.</DialogDescription></DialogHeader>
    <HubDetails hub={hub} />
    <HubAssignedUsers key={hub.id} hub={hub} revision={revision} />
  </DialogContent></Dialog>;
}
