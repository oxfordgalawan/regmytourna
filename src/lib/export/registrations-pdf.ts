import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPhpPdf } from "@/lib/format";
import {
  groupRowsByDivision,
  REGISTRATION_EXPORT_HEADERS,
  rowToExportCells,
  type ExportCategory,
  type ExportRegistrationRow,
} from "./registration-export-rows";

type AutoTableDoc = jsPDF & { lastAutoTable: { finalY: number } };

const MARGIN = 14;
const UMBER_RGB: [number, number, number] = [69, 48, 26];

function footer(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("RegMyTourna", MARGIN, pageHeight - 8);
  const stamp = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  doc.text(stamp, pageWidth - MARGIN, pageHeight - 8, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

export function buildRegistrationsPdf(
  categories: ExportCategory[],
  rows: ExportRegistrationRow[],
  opts?: { eventName?: string }
): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }) as AutoTableDoc;
  const byDivision = groupRowsByDivision(rows);
  const pageHeight = doc.internal.pageSize.getHeight();
  let startY = MARGIN;

  if (opts?.eventName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${opts.eventName} — Entries`, MARGIN, startY);
    startY += 10;
    doc.setFont("helvetica", "normal");
  }

  categories.forEach((cat, index) => {
    const body = (byDivision.get(cat.id) ?? []).map((r) => rowToExportCells(r, formatPhpPdf));
    const spaceNeeded = 16 + (body.length ? body.length * 5 : 8);
    if (startY + spaceNeeded > pageHeight - 20 && index > 0) {
      doc.addPage();
      startY = MARGIN;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(cat.name, MARGIN, startY);
    startY += 6;
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY,
      head: [[...REGISTRATION_EXPORT_HEADERS]],
      body,
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: UMBER_RGB, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 242, 238] },
      margin: { left: MARGIN, right: MARGIN },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 48 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 24 },
        7: { cellWidth: 18 },
      },
      didDrawPage: () => footer(doc),
    });

    startY = doc.lastAutoTable.finalY + 12;
  });

  if (categories.length === 0) {
    footer(doc);
  }

  const out = doc.output("arraybuffer");
  return Buffer.from(out);
}