"use client";

import { Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CompanySummary } from "@/types/companies";
import { CompanyMembers } from "../table-view/company-members";

export function ViewCompanyDialog({
  company,
  onClose,
}: {
  company: CompanySummary;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5" aria-hidden="true" />
            {company.name}
          </DialogTitle>
          <DialogDescription>Members of this company.</DialogDescription>
        </DialogHeader>
        <CompanyMembers companyId={company.id} />
      </DialogContent>
    </Dialog>
  );
}
