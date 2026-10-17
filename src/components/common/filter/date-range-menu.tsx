"use client";

import { useId, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DATE_PRESET_BUTTONS,
  formatDateForInput,
  getDatePresetLabel,
  parseDateFromInput,
} from "@/utils/dateRangePresets";
import type { DatePreset, DateRangeFilterValue } from "@/types/date-range";
import { cn } from "@/lib/utils";

export type DateRangeMenuProps = {
  value: DateRangeFilterValue;
  onChange: (value: DateRangeFilterValue) => void;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  modal?: boolean;
  contentClassName?: string;
  disabled?: boolean;
};

const fieldLabelClass =
  "text-xs font-medium uppercase tracking-wider text-muted-foreground";

export function DateRangeMenu({
  value,
  onChange,
  className,
  triggerClassName,
  align = "start",
  modal = false,
  contentClassName,
  disabled = false,
}: DateRangeMenuProps) {
  const [open, setOpen] = useState(false);
  const fromId = useId();
  const toId = useId();
  const label = getDatePresetLabel(
    value.preset,
    value.customStart,
    value.customEnd,
  );
  const bothDates = Boolean(value.customStart && value.customEnd);

  function selectPreset(preset: DatePreset) {
    onChange({ preset, customStart: undefined, customEnd: undefined });
    setOpen(false);
  }

  function changeStart(raw: string) {
    const customStart = parseDateFromInput(raw);
    onChange({
      preset:
        customStart && value.customEnd ? "custom" : value.preset,
      customStart,
      customEnd: value.customEnd,
    });
  }

  function changeEnd(raw: string) {
    const customEnd = parseDateFromInput(raw);
    onChange({
      preset: value.customStart && customEnd ? "custom" : value.preset,
      customStart: value.customStart,
      customEnd,
    });
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen} modal={modal}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-between md:w-[220px]",
              triggerClassName,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Calendar className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </span>
            <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          className={cn("w-[360px] p-0", contentClassName)}
        >
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <p className={fieldLabelClass}>Quick Filters</p>
              <div className="grid grid-cols-2 gap-2">
                {DATE_PRESET_BUTTONS.map((option) => (
                  <Button
                    key={option.preset}
                    type="button"
                    size="sm"
                    variant={
                      value.preset === option.preset ? "default" : "outline"
                    }
                    className="h-9"
                    onClick={() => selectPreset(option.preset)}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={value.preset === "all" ? "default" : "outline"}
                  className="col-span-2 h-9"
                  onClick={() => selectPreset("all")}
                >
                  All Time
                </Button>
              </div>
            </div>
            <div className="space-y-4 border-t pt-4">
              <p className={fieldLabelClass}>Custom Range</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor={fromId}>From</Label>
                  <Input
                    id={fromId}
                    type="date"
                    className="h-9"
                    value={formatDateForInput(value.customStart)}
                    onChange={(event) => changeStart(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={toId}>To</Label>
                  <Input
                    id={toId}
                    type="date"
                    className="h-9"
                    value={formatDateForInput(value.customEnd)}
                    onChange={(event) => changeEnd(event.target.value)}
                  />
                </div>
              </div>
              {bothDates && (
                <Button
                  type="button"
                  variant={value.preset === "custom" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => {
                    onChange({
                      preset: "custom",
                      customStart: value.customStart,
                      customEnd: value.customEnd,
                    });
                    setOpen(false);
                  }}
                >
                  <Calendar className="size-4" aria-hidden="true" />
                  Apply Custom Range
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
