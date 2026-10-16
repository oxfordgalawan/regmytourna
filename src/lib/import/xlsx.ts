import ExcelJS from "exceljs";
import { readXlsxLite, type LiteSheet } from "./xlsx-lite";
import { gridFromText, rowsFromCategoryGrid, rowsFromGrid, type ImportCategory, type RawRow } from "./players";

/**
 * Server-only Excel helpers for the player import. The template has one sheet
 * per category (the tab and the title are the category), with Player 1 and
 * Player 2 columns — nothing else to fill in.
 */

const BONE = "FFE0DAC8";
const UMBER = "FF45301A";
const ESPRESSO = "FF1F1610";
const HELP_SHEET = "How to fill";

/** Excel tab names: max 31 chars, no : \ / ? * [ ], unique. */
function sheetNames(categories: ImportCategory[]) {
  const used = new Set<string>([HELP_SHEET.toLowerCase()]);
  return categories.map((c) => {
    const base = c.name.replace(/[:\\/?*[\]]/g, "-").replace(/^'+|'+$/g, "").slice(0, 31).trim() || "Category";
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 31 - ` (${n})`.length)} (${n})`;
    used.add(name.toLowerCase());
    return name;
  });
}

export async function buildPlayersTemplate(event: { name: string }, categories: ImportCategory[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RegMyTourna";
  wb.created = new Date();
  const names = sheetNames(categories);

  categories.forEach((c, i) => {
    const doubles = c.format === "doubles";
    const ws = wb.addWorksheet(names[i], {
      views: [{ state: "frozen", ySplit: 2 }],
      properties: { tabColor: { argb: UMBER } },
    });
    ws.getColumn(1).width = 34;
    ws.getColumn(2).width = doubles ? 34 : 12;

    // row 1: the category (this is what the import reads)
    ws.mergeCells(1, 1, 1, doubles ? 2 : 1);
    const title = ws.getCell(1, 1);
    title.value = c.name;
    title.font = { bold: true, size: 14, color: { argb: BONE } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ESPRESSO } };
    title.alignment = { vertical: "middle", indent: 1 };
    title.note = "Keep this title as is — it tells us which category these players belong to.";
    ws.getRow(1).height = 28;

    // row 2: column headers
    const headers = doubles ? ["Player 1", "Player 2"] : ["Player"];
    headers.forEach((h, j) => {
      const cell = ws.getCell(2, j + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: BONE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: UMBER } };
      cell.alignment = { vertical: "middle", indent: 1 };
    });
    ws.getRow(2).height = 22;
  });

  // ── How to fill (last tab)
  const help = wb.addWorksheet(HELP_SHEET);
  help.getColumn(1).width = 96;
  const lines: Array<[string, boolean?]> = [
    [`${event.name} — player list`, true],
    [""],
    ["Each tab at the bottom is one category. Open a tab and type the players under the header:"],
    ["    • Doubles: Player 1 and Player 2 are the team (one team per row)."],
    ["    • Singles: one player per row."],
    ["Don't rename the title in the first row — it tells us the category."],
    ["Save the file, then upload it on the Players tab. You'll see a preview before anything is saved."],
    ["You can upload again later to add more players — people already imported are skipped."],
    [""],
    ["Categories in this file:", true],
    ...categories.map((c): [string] => [`    • ${c.name} (${c.format === "doubles" ? "doubles" : "singles"})`]),
  ];
  lines.forEach(([text, bold], i) => {
    const cell = help.getCell(i + 1, 1);
    cell.value = text;
    if (bold) cell.font = { bold: true, size: i === 0 ? 14 : 11 };
  });

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function gridOf(ws: ExcelJS.Worksheet) {
  const grid: string[][] = [];
  const last = Math.min(ws.rowCount, 2100);
  for (let r = 1; r <= last; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= Math.max(4, Math.min(row.cellCount, 12)); c++) cells.push(row.getCell(c).text ?? "");
    grid.push(cells);
  }
  return grid;
}

async function sheetsFromExcelJs(data: ArrayBuffer): Promise<LiteSheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  return wb.worksheets.map((ws) => ({ name: ws.name, visible: ws.state === "visible", grid: gridOf(ws) }));
}

/**
 * Reads an uploaded workbook. Our template: one sheet per category, the
 * category in cell A1. Also accepts a single sheet with a Category column.
 * Falls back to a lighter reader if ExcelJS can't open the file.
 */
export async function rowsFromXlsx(data: ArrayBuffer): Promise<RawRow[]> {
  let all: LiteSheet[];
  try {
    all = await sheetsFromExcelJs(data);
  } catch (e) {
    console.error("[player-import] ExcelJS couldn't read the workbook, using the fallback reader:", e);
    all = await readXlsxLite(data);
  }
  const sheets = all.filter((w) => w.visible && w.name !== HELP_SHEET);
  const rows: RawRow[] = [];
  for (const ws of sheets) {
    const grid = ws.grid;
    const header = grid.slice(0, 5).some((r) => (r ?? []).some((c) => /^\s*category\s*$/i.test(c ?? "")));
    if (header) {
      // a single list with a Category column
      rows.push(...rowsFromGrid(grid).map((r) => ({ ...r, sheet: ws.name })));
    } else {
      const category = (grid[0]?.[0] ?? "").trim() || ws.name;
      rows.push(...rowsFromCategoryGrid(grid, category, ws.name));
    }
  }
  return rows;
}

/** CSV with a Category column, kept for people exporting from other tools. */
export function rowsFromCsv(text: string): RawRow[] {
  return rowsFromGrid(gridFromText(text));
}
