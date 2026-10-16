"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleAlert,
  ClipboardPaste,
  FileSpreadsheet,
  GitBranch,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { commitPlayerImportAction, previewPlayerImportAction } from "@/app/actions/player-import";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ImportPreview, RawRow } from "@/lib/import/players";
import { entrantNoun } from "@/lib/categories";
import { cn } from "@/lib/utils";

type Step = "source" | "preview" | "done";

/**
 * Bulk import for bracket-only events: drop the Excel file (or paste rows),
 * check the preview, confirm. Nothing is saved until the last step.
 */
export function ImportPlayersDialog({
  tournamentId,
  categories,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  categories: Array<{ id: string; name: string; format: string }>;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("source");
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [pasteInto, setPasteInto] = useState(categories[0]?.id ?? "");
  const pasteCat = categories.find((c) => c.id === pasteInto);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [raiseCapacity, setRaiseCapacity] = useState(true);
  const [added, setAdded] = useState(0);

  function reset() {
    setStep("source");
    setFile(null);
    setText("");
    setPreview(null);
    setRows([]);
    setOnlyIssues(false);
  }

  function close(o: boolean) {
    if (pending) return;
    onOpenChange(o);
    if (!o) setTimeout(reset, 200);
  }

  function check() {
    const fd = new FormData();
    if (tab === "file" && file) fd.set("file", file);
    if (tab === "paste") {
      fd.set("text", text);
      fd.set("divisionId", pasteInto);
    }
    fd.set("mode", mode);
    startTransition(async () => {
      const res = await previewPlayerImportAction(tournamentId, fd);
      if (res.error || !res.preview) {
        toast.error(res.error ?? "Couldn't read that.");
        return;
      }
      setPreview(res.preview);
      setRows(res.rows ?? []);
      setOnlyIssues(res.preview.errors > 0);
      setStep("preview");
    });
  }

  function commit() {
    startTransition(async () => {
      const res = await commitPlayerImportAction(tournamentId, rows, { mode, raiseCapacity });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setAdded(res.added ?? 0);
      setStep("done");
      router.refresh();
    });
  }

  const over = preview?.categories.filter((c) => c.overCapacity) ?? [];
  const visibleRows = (preview?.rows ?? []).filter(
    (r) => !onlyIssues || r.status !== "ok" || r.warnings.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className={cn(
          "flex max-h-[92dvh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border border-umber bg-espresso p-0",
          step === "preview" ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 pt-5 pb-4">
          {step === "preview" && (
            <button
              type="button"
              onClick={() => setStep("source")}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-bone hover:border-umber"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div className="min-w-0 pr-6">
            <DialogTitle className="text-base text-bone">
              {step === "source" ? "Import players" : step === "preview" ? "Check before importing" : "Players imported"}
            </DialogTitle>
            <DialogDescription>
              {step === "source"
                ? "Upload the filled-in template — nothing is saved until you confirm."
                : step === "preview"
                  ? `${preview?.ok ?? 0} ready · ${preview?.skipped ?? 0} already in · ${preview?.errors ?? 0} need fixing`
                  : "They're in your brackets now."}
            </DialogDescription>
          </div>
        </div>

        <div key={step} className="min-h-0 flex-1 animate-rise overflow-y-auto px-5 py-5">
          {step === "source" && (
            <div className="space-y-5">
              <div className="flex gap-1 rounded-full border border-line p-1 text-sm">
                {(
                  [
                    ["file", FileSpreadsheet, "Upload file"],
                    ["paste", ClipboardPaste, "Paste rows"],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-1.5 transition-colors",
                      tab === value ? "bg-bone text-ink" : "text-muted-foreground hover:text-bone"
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>

              {tab === "file" ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) setFile(f);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                    dragging ? "border-brass bg-brass/10" : file ? "border-umber bg-ink/40" : "border-line hover:border-umber"
                  )}
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-umber/40 text-brass">
                    {file ? <FileSpreadsheet className="size-5" /> : <Upload className="size-5" />}
                  </span>
                  <span className="mt-3 text-sm font-semibold text-bone">
                    {file ? file.name : "Drop your .xlsx or .csv here"}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {file ? `${Math.max(1, Math.round(file.size / 1024))} KB · tap to choose another` : "or tap to choose a file"}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="ip-cat" className="eyebrow">
                      Paste into
                    </label>
                    <select
                      id="ip-cat"
                      value={pasteInto}
                      onChange={(e) => setPasteInto(e.target.value)}
                      className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-bone outline-none focus:border-umber"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={8}
                    placeholder={
                      pasteCat?.format === "doubles"
                        ? "Copy the two name columns from Excel or Google Sheets and paste here.\n\nJuan Dela Cruz\tPedro Santos\nAna Reyes\tBea Cruz"
                        : "One player per line.\n\nLeo Ramos\nMark Villanueva"
                    }
                    className="w-full rounded-xl border border-line bg-ink/40 p-3 font-mono text-xs text-bone outline-none placeholder:text-muted-foreground/60 focus:border-umber"
                  />
                  <p className="text-xs text-muted-foreground">
                    {pasteCat?.format === "doubles"
                      ? "Two columns: Player 1 and Player 2. One team per line."
                      : "One player per line."}
                  </p>
                </div>
              )}

              <fieldset className="space-y-2">
                <legend className="eyebrow mb-2">If a category already has players</legend>
                {(
                  [
                    ["add", "Add to them", "Keeps everyone; people already in are skipped."],
                    ["replace", "Replace them", "Removes the current list in the categories in this file."],
                  ] as const
                ).map(([value, title, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      mode === value ? "border-bone bg-bone/[0.06]" : "border-line hover:border-umber"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        mode === value ? "border-bone bg-bone" : "border-bone/30"
                      )}
                    >
                      {mode === value && <span className="size-1.5 rounded-full bg-ink" />}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-bone">{title}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                ))}
              </fieldset>

              <Button
                size="lg"
                className="w-full"
                disabled={pending || (tab === "file" ? !file : !text.trim())}
                onClick={check}
              >
                {pending && <Loader2 className="animate-spin" />}
                Check the list
              </Button>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-5">
              <ul className="grid gap-2 sm:grid-cols-2">
                {preview.categories.map((c) => (
                  <li
                    key={c.divisionId}
                    className={cn(
                      "rounded-xl border px-4 py-3",
                      c.overCapacity ? "border-brass/50 bg-brass/[0.06]" : "border-line bg-surface"
                    )}
                  >
                    <p className="truncate text-sm font-semibold text-bone">{c.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="text-bone">+{c.adding}</span> {entrantNoun(c.format, c.adding)}
                      {mode === "add" && c.existing > 0 ? ` · ${c.existing} already in` : ""}
                      {mode === "replace" && c.existing > 0 ? ` · replaces ${c.existing}` : ""}
                      {c.capacity ? ` · ${c.total}/${c.capacity}` : ""}
                    </p>
                  </li>
                ))}
              </ul>

              {over.length > 0 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brass/40 bg-brass/[0.06] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={raiseCapacity}
                    onChange={(e) => setRaiseCapacity(e.target.checked)}
                    className="mt-1 accent-[#b98e5a]"
                  />
                  <span className="text-sm text-bone">
                    Raise the limit to fit everyone
                    <span className="block text-xs text-muted-foreground">
                      {over.map((c) => `${c.name}: ${c.capacity} → ${c.total}`).join(" · ")}
                    </span>
                  </span>
                </label>
              )}

              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-bone">Rows</h3>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
                  Only show problems
                </label>
              </div>

              {visibleRows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted-foreground">
                  No problems — every row is ready.
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {visibleRows.map((r) => (
                    <li
                      key={`${r.sheet ?? ""}-${r.row}`}
                      className={cn("flex gap-3 px-3 py-2.5 text-sm", r.status === "error" ? "bg-[#e58a72]/[0.06]" : "bg-surface")}
                    >
                      <span className="w-14 shrink-0 pt-0.5 font-mono text-[0.7rem] text-muted-foreground">row {r.row}</span>
                      <span className="shrink-0 pt-0.5">
                        {r.status === "ok" && !r.warnings.length ? (
                          <Check className="size-4 text-brass" />
                        ) : r.status === "error" ? (
                          <CircleAlert className="size-4 text-[#e58a72]" />
                        ) : (
                          <AlertTriangle className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-bone">
                          {[r.p1, r.p2].filter(Boolean).join(" & ") || "—"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{r.category || "No category"}</span>
                        {[...r.errors, ...r.warnings].map((m) => (
                          <span
                            key={m}
                            className={cn("mt-0.5 block text-xs", r.errors.includes(m) ? "text-[#e58a72]" : "text-muted-foreground")}
                          >
                            {m}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex size-14 animate-[pop_400ms_cubic-bezier(.2,1.4,.4,1)_both] items-center justify-center rounded-full bg-bone text-ink">
                <Check className="size-7" strokeWidth={3} />
              </span>
              <p className="display mt-4 text-5xl text-bone">{added}</p>
              <p className="text-sm text-muted-foreground">{added === 1 ? "entry" : "entries"} added</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href={`/organizer/tournaments/${tournamentId}/draw`}>
                    <GitBranch />
                    Go to Brackets
                  </Link>
                </Button>
                <Button variant="ghost" onClick={() => close(false)}>
                  Back to players
                </Button>
              </div>
            </div>
          )}
        </div>

        {step === "preview" && preview && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ink/40 px-5 py-4">
            <p className="text-xs text-muted-foreground">
              {preview.errors > 0
                ? `${preview.errors} row${preview.errors === 1 ? "" : "s"} will be left out — fix them in the file and import again any time.`
                : "Everything looks good."}
            </p>
            <Button disabled={pending || preview.ok === 0 || (over.length > 0 && !raiseCapacity)} onClick={commit}>
              {pending && <Loader2 className="animate-spin" />}
              Import {preview.ok} {preview.ok === 1 ? "entry" : "entries"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
