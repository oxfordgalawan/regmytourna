"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import { addDivisionAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  CategoryFields,
  categoryFieldsReady,
  type CategoryFieldsState,
} from "@/components/organizer/category-fields";
import { categoryName, categoryType, type CategoryType } from "@/lib/categories";

/** "Add category" button + modal (same fields as the create form). */
export function AddDivisionForm({
  tournamentId,
  showFee = true,
  label = "Add category",
}: {
  tournamentId: string;
  /** bracket-only events don't charge fees */
  showFee?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<CategoryFieldsState>({
    type: "mens_doubles",
    title: "",
    capacity: "16",
    fee: "",
  });
  const [loading, setLoading] = useState(false);
  const format = categoryType(fields.type).format;
  const name = categoryName(fields.type, fields.title);

  function reset() {
    setFields({ type: "mens_doubles", title: "", capacity: "16", fee: "" });
  }

  async function save(keepOpen: boolean) {
    setLoading(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("format", format);
    fd.set("capacity", fields.capacity);
    if (showFee && fields.fee) fd.set("entryFeeCents", String(Math.round(Number(fields.fee) * 100)));
    if (!showFee) fd.set("entryFeeCents", "0");
    const result = await addDivisionAction(tournamentId, fd);
    setLoading(false);
    if (result.error) {
      toast.error(
        typeof result.error === "string" && result.error.includes("duplicate")
          ? `"${name}" already exists`
          : typeof result.error === "string"
            ? result.error
            : "Please check the fields and try again."
      );
      return;
    }
    toast.success(`Added ${name}`);
    reset();
    router.refresh();
    if (!keepOpen) setOpen(false);
  }

  const ready = categoryFieldsReady(fields.capacity);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <DialogContent className="gap-0 overflow-hidden border border-umber bg-espresso p-0 sm:max-w-lg">
          <div className="border-b border-line px-5 pt-5 pb-4">
            <DialogTitle className="text-base text-bone">Add a category</DialogTitle>
            <DialogDescription>Each category is its own bracket.</DialogDescription>
          </div>

          <form
            className="space-y-5 px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) void save(false);
            }}
          >
            <CategoryFields
              idPrefix="add-category"
              showFee={showFee}
              value={fields}
              onChange={(patch) =>
                setFields((f) => ({
                  ...f,
                  ...patch,
                  ...(patch.type ? { type: patch.type as CategoryType } : {}),
                }))
              }
            />

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" disabled={loading || !ready} onClick={() => void save(true)}>
                Save &amp; add another
              </Button>
              <Button type="submit" disabled={loading || !ready}>
                {loading ? <Loader2 className="animate-spin" /> : <Plus />}
                Add category
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}