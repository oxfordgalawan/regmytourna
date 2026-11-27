"use client";

import { useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import {
  exportRegistrationsPdfAction,
  exportRegistrationsXlsxAction,
} from "@/app/actions/export-registrations";
import type { ExportCategory, ExportRegistrationRow } from "@/lib/export/registration-export-rows";
import { toast } from "@/lib/ui/app-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function downloadBase64(base64: string, filename: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportRegistrationsButton({
  tournamentId,
  slug,
  eventName,
  categories,
  registrations,
}: {
  tournamentId: string;
  slug: string;
  eventName: string;
  categories: ExportCategory[];
  registrations: ExportRegistrationRow[];
}) {
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);

  async function runExport(kind: "xlsx" | "pdf") {
    setBusy(kind);
    const payload = { slug, eventName, categories, rows: registrations };
    const res =
      kind === "xlsx"
        ? await exportRegistrationsXlsxAction(tournamentId, payload)
        : await exportRegistrationsPdfAction(tournamentId, payload);
    setBusy(null);
    if (res.error || !res.base64) {
      toast.error(res.error ?? "Export failed.");
      return;
    }
    const mime =
      kind === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";
    downloadBase64(res.base64, res.filename ?? `entries.${kind === "xlsx" ? "xlsx" : "pdf"}`, mime);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="secondary" size="sm" disabled={busy !== null} className="gap-1">
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            Export
            <ChevronDown className="size-4 opacity-70" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem className="gap-2" disabled={busy !== null} onClick={() => void runExport("xlsx")}>
          <FileSpreadsheet className="size-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" disabled={busy !== null} onClick={() => void runExport("pdf")}>
          <FileText className="size-4" />
          PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}