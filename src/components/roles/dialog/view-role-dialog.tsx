"use client";

import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RoleSummary } from "@/types/roles";
import { RoleDetails } from "../role-details";

export function ViewRoleDialog({
  role,
  onClose,
}: {
  role: RoleSummary;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" aria-hidden="true" />
            {role.name}
          </DialogTitle>
          <DialogDescription>Access, permissions, and assignments for this role.</DialogDescription>
        </DialogHeader>
        <RoleDetails role={role} />
      </DialogContent>
    </Dialog>
  );
}
