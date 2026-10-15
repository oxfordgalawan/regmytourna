"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Midnight in `type="time"` value (12:00 AM). */
export const DEFAULT_REGISTRATION_TIME = "00:00";

export function splitRegistrationDateTime(value: string) {
  if (!value) return { date: "", time: DEFAULT_REGISTRATION_TIME };
  const [date, rawTime] = value.split("T");
  const time = rawTime?.slice(0, 5) || DEFAULT_REGISTRATION_TIME;
  return { date: date ?? "", time };
}

export function combineRegistrationDateTime(date: string, time: string) {
  if (!date) return "";
  return `${date}T${time || DEFAULT_REGISTRATION_TIME}`;
}

type RegistrationDateTimeInputProps = {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  "aria-invalid"?: boolean;
  className?: string;
};

export function RegistrationDateTimeInput({
  id,
  name,
  value,
  onChange,
  min,
  max,
  "aria-invalid": ariaInvalid,
  className,
}: RegistrationDateTimeInputProps) {
  const { date, time } = splitRegistrationDateTime(value);
  const minDate = min?.split("T")[0];
  const maxDate = max?.split("T")[0];
  const minTime = min?.split("T")[1]?.slice(0, 5);
  const maxTime = max?.split("T")[1]?.slice(0, 5);
  const timeMin = date && minDate && date === minDate ? minTime : undefined;
  const timeMax = date && maxDate && date === maxDate ? maxTime : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:items-end">
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Date</span>
          <Input
            id={id}
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => onChange(combineRegistrationDateTime(e.target.value, time))}
            aria-invalid={ariaInvalid}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">
            Time · <span className="font-mono">hr</span> : <span className="font-mono">min</span>
          </span>
          <Input
            id={`${id}-time`}
            type="time"
            value={time}
            step={60}
            min={timeMin}
            max={timeMax}
            onChange={(e) =>
              onChange(combineRegistrationDateTime(date, e.target.value || DEFAULT_REGISTRATION_TIME))
            }
            aria-label="Registration time"
          />
        </div>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
