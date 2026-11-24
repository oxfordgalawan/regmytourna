"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { updatePlayerNameAction } from "@/app/actions/organizer-players";

/** Guest name on the Registrations tab — organizers can fix typos inline. */
export function PlayerNameCell({
  registrationId,
  rowId,
  name,
}: {
  registrationId: string;
  rowId: string;
  name: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updatePlayerNameAction(registrationId, rowId, value);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Name updated.");
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form
        className="flex max-w-[18rem] items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue(name);
              setEditing(false);
            }
          }}
          placeholder="Full name"
          aria-label="Player name"
          className="h-7 min-w-0 flex-1 rounded-md border border-umber bg-ink/60 px-2 text-sm text-bone outline-none focus:border-brass"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Save name"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-bone text-ink disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setValue(name);
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
    <span className="flex max-w-[18rem] items-center gap-1.5">
      <span className="min-w-0 truncate font-medium text-bone">{name}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex shrink-0 items-center gap-1 rounded px-1 text-[0.65rem] text-muted-foreground transition-colors hover:text-bone"
        aria-label="Edit name"
        title="Fix this name"
      >
        <Pencil className="size-3" />
        Edit
      </button>
    </span>
  );
}