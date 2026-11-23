"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { updateDivisionDetailsAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  CategoryFields,
  categoryFieldsReady,
  type CategoryFieldsState,
} from "@/components/organizer/category-fields";
import { categoryName, parseCategoryFromDivisionName, type CategoryType } from "@/lib/categories";

export function EditDivisionForm({
  divisionId,
  divisionName,
  capacity,
  entryFeeCents,
  defaultEventFeeCents,
  confirmedEntries,
  format,
}: {
  divisionId: string;
  divisionName: string;
  capacity: number | null;
  entryFeeCents: number | null;
  defaultEventFeeCents: number;
  confirmedEntries: number;
  format: string;
}) {
  const router = useRouter();
  const parsed = useMemo(() => parseCategoryFromDivisionName(divisionName), [divisionName]);
  const initialFee =
    entryFeeCents != null ? String(entryFeeCents / 100) : "";

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<CategoryFieldsState>({
    type: parsed.type,
    title: parsed.title,
    capacity: String(capacity ?? 16),
    fee: initialFee,
  });

  const sameFormatOnly = confirmedEntries > 0;
  const lockedFormat = sameFormatOnly ? (format === "singles" ? "singles" : "doubles") : undefined;

  function openDialog() {
    setFields({
      type: parsed.type,
      title: parsed.title,
      capacity: String(capacity ?? 16),
      fee: initialFee,
    });
    setOpen(true);
  }

  async function save() {
    setLoading(true);
    const fd = new FormData();
    fd.set("type", fields.type);
    fd.set("title", fields.title);
    fd.set("capacity", fields.capacity);
    if (fields.fee.trim()) fd.set("entryFeeCents", String(Math.round(Number(fields.fee) * 100)));
    const result = await updateDivisionDetailsAction(divisionId, fd);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Saved ${categoryName(fields.type, fields.title)}`);
    setOpen(false);
    router.refresh();
  }

  const ready = categoryFieldsReady(fields.capacity);

  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={openDialog}>
        <Pencil className="size-3.5" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <DialogContent className="gap-0 overflow-hidden border border-umber bg-espresso p-0 sm:max-w-lg">
          <div className="border-b border-line px-5 pt-5 pb-4">
            <DialogTitle className="text-base text-bone">Edit category</DialogTitle>
            <DialogDescription>
              {sameFormatOnly
                ? "Players are already registered — you can change gender within the same format (singles or doubles)."
                : "Gender, title, capacity, and fee."}
            </DialogDescription>
          </div>

          <form
            className="space-y-5 px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) void save();
            }}
          >
            <CategoryFields
              idPrefix={`edit-${divisionId}`}
              showFee
              lockedFormat={lockedFormat}
              value={fields}
              onChange={(patch) =>
                setFields((f) => ({
                  ...f,
                  ...patch,
                  ...(patch.type ? { type: patch.type as CategoryType } : {}),
                }))
              }
            />
            {sameFormatOnly && (
              <p className="text-xs text-muted-foreground">
                Singles and doubles can&apos;t be switched while entries exist. Fee left blank uses the event default (
                ₱{(defaultEventFeeCents / 100).toFixed(0)}).
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={loading} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !ready}>
                {loading ? <Loader2 className="animate-spin" /> : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}