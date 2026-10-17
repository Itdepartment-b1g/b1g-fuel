"use client";

import { Ruler } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MeasurementSummary } from "@/types/measurements";
import { MeasurementUnits } from "../table-view/measurements-table-view";

export function ViewMeasurementDialog({
  measurement,
  onClose,
}: {
  measurement: MeasurementSummary;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="size-5" aria-hidden="true" />
            {measurement.name}
          </DialogTitle>
          <DialogDescription>Units for this measurement.</DialogDescription>
        </DialogHeader>
        <MeasurementUnits measurement={measurement} />
      </DialogContent>
    </Dialog>
  );
}
