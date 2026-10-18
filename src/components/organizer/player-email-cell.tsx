"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { updatePlayerEmailAction } from "@/app/actions/organizer-players";
import { cn } from "@/lib/utils";

/**
 * A player's email on the Registrations tab. Guest emails (typed in at
 * registration) can be corrected inline; account emails are read-only.
 */
export function PlayerEmailCell({
  registrationId,
  rowId,
  email,
  hasAccount,
  partner,
}: {
  registrationId: string;
  rowId: string;
  email: string | null;
  hasAccount: boolean;
  partner: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(email ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updatePlayerEmailAction(registrationId, rowId, value);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        value.trim()
          ? partner
            ? "Email updated — we'll send the invite to the new address."
            : "Email updated."
          : "Email removed."
      );
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form
        className="mt-0.5 flex max-w-[18rem] items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          type="email"
          inputMode="email"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue(email ?? "");
              setEditing(false);
            }
          }}
          placeholder="name@email.com"
          aria-label="Player email"
          className="h-7 min-w-0 flex-1 rounded-md border border-umber bg-ink/60 px-2 font-mono text-[0.7rem] text-bone outline-none focus:border-brass"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Save email"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-bone text-ink disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setValue(email ?? "");
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
    <span className="group/email flex max-w-[18rem] items-center gap-1.5">
      <span
        className={cn(
          "min-w-0 truncate font-mono text-[0.7rem]",
          email ? "text-bone/60" : "text-muted-foreground/60"
        )}
      >
        {email ? (
          <a href={`mailto:${email}`} className="hover:text-bone hover:underline">
            {email}
          </a>
        ) : (
          "No email"
        )}
      </span>
      {hasAccount ? (
        <span className="shrink-0 font-mono text-[0.6rem] text-brass/80" title="Account email — only the player can change it">
          account
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex shrink-0 items-center gap-1 rounded px-1 text-[0.65rem] text-muted-foreground opacity-70 transition-opacity hover:text-bone group-hover/email:opacity-100"
          aria-label={email ? "Edit email" : "Add email"}
          title={email ? "Fix this email" : "Add an email"}
        >
          <Pencil className="size-3" />
          {!email && "Add"}
        </button>
      )}
    </span>
  );
}
