import ExcelJS from "exceljs";
import { excelSheetNames } from "@/lib/import/sheet-names";
import {
  groupRowsByDivision,
  REGISTRATION_EXPORT_HEADERS,
  rowToExportCells,
  type ExportCategory,
  type ExportRegistrationRow,
} from "./registration-export-rows";

export type { ExportCategory, ExportRegistrationRow } from "./registration-export-rows";

const BONE = "FFE0DAC8";
const UMBER = "FF45301A";
const ESPRESSO = "FF1F1610";

function headerStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: BONE } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: UMBER } };
  cell.alignment = { vertical: "middle", indent: 1 };
}

export async function buildRegistrationsExport(
  categories: ExportCategory[],
  rows: ExportRegistrationRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RegMyTourna";
  wb.created = new Date();

  const byDivision = groupRowsByDivision(rows);
  const tabNames = excelSheetNames(categories.map((c) => c.name));

  categories.forEach((cat, i) => {
    const ws = wb.addWorksheet(tabNames[i], {
      views: [{ state: "frozen", ySplit: 2 }],
      properties: { tabColor: { argb: UMBER } },
    });
    ws.getColumn(1).width = 32;
    ws.getColumn(2).width = 36;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 14;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 14;
    ws.getColumn(8).width = 12;

    ws.mergeCells(1, 1, 1, REGISTRATION_EXPORT_HEADERS.length);
    const title = ws.getCell(1, 1);
    title.value = cat.name;
    title.font = { bold: true, size: 14, color: { argb: BONE } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ESPRESSO } };
    title.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(1).height = 28;

    REGISTRATION_EXPORT_HEADERS.forEach((h, j) => {
      const cell = ws.getCell(2, j + 1);
      cell.value = h;
      headerStyle(cell);
    });
    ws.getRow(2).height = 22;

    const divisionRows = byDivision.get(cat.id) ?? [];
    divisionRows.forEach((r, rowIdx) => {
      rowToExportCells(r).forEach((val, col) => {
        ws.getCell(rowIdx + 3, col + 1).value = val;
      });
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}