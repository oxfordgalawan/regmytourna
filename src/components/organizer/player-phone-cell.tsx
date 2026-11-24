"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { updatePlayerPhoneAction } from "@/app/actions/organizer-players";
import { cn } from "@/lib/utils";

/** Guest or account phone on the Registrations tab. */
export function PlayerPhoneCell({
  registrationId,
  rowId,
  phone,
  hasAccount,
}: {
  registrationId: string;
  rowId: string;
  phone: string | null;
  hasAccount: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updatePlayerPhoneAction(registrationId, rowId, value);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(value.trim() ? "Phone updated." : "Phone removed.");
      setEditing(false);
      router.refresh();
    });
  }

  if (editing && !hasAccount) {
    return (
      <form
        className="mt-0.5 flex max-w-[18rem] items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          type="tel"
          inputMode="tel"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue(phone ?? "");
              setEditing(false);
            }
          }}
          placeholder="09XXXXXXXXX"
          aria-label="Player phone"
          className="h-7 min-w-0 flex-1 rounded-md border border-umber bg-ink/60 px-2 font-mono text-[0.7rem] text-bone outline-none focus:border-brass"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Save phone"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-bone text-ink disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setValue(phone ?? "");
            setEditing(false);
          }}
          aria-label="Cancel"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-bone"
        >
          <X className="size-3.5" />
        </button>
      </form>
    );
  }

  return (
    <span className="mt-0.5 flex max-w-[18rem] items-center gap-1.5">
      <span
        className={cn(
          "min-w-0 truncate font-mono text-[0.7rem]",
          phone ? "text-bone/60" : "text-muted-foreground/60"
        )}
      >
        {phone ? (
          <a href={`tel:${phone}`} className="hover:text-bone hover:underline">
            {phone}
          </a>
        ) : (
          "No phone"
        )}
      </span>
      {!hasAccount && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex shrink-0 items-center gap-1 rounded px-1 text-[0.65rem] text-muted-foreground transition-colors hover:text-bone"
          aria-label={phone ? "Edit phone" : "Add phone"}
          title={phone ? "Fix this number" : "Add a number"}
        >
          <Pencil className="size-3" />
          {phone ? "Edit" : "Add"}
        </button>
      )}
    </span>
  );
}