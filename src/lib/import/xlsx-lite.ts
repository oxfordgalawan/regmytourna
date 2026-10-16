import JSZip from "jszip";

/**
 * A tiny, forgiving .xlsx reader: just sheet names, visibility and cell text.
 * Used when ExcelJS rejects a workbook (it's strict about some extras Excel or
 * Google Sheets add — comments, themes, tables, odd styles).
 */

export type LiteSheet = { name: string; visible: boolean; grid: string[][] };

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/** All text runs inside an element (<t>…</t>, including rich text). */
const textOf = (xml: string) => decode([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;

function colIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function readXlsxLite(data: ArrayBuffer): Promise<LiteSheet[]> {
  const zip = await JSZip.loadAsync(data);
  const read = async (path: string) => (await zip.file(path)?.async("string")) ?? null;

  const workbook = await read("xl/workbook.xml");
  if (!workbook) throw new Error("not an .xlsx workbook");
  const rels = (await read("xl/_rels/workbook.xml.rels")) ?? "";
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) targets.set(id, target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }

  const shared: string[] = [];
  const sst = await read("xl/sharedStrings.xml");
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));

  const sheets: LiteSheet[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const tag = m[0];
    const name = decode(attr(tag, "name") ?? "Sheet");
    const state = attr(tag, "state");
    const rid = attr(tag, "r:id") ?? tag.match(/\s\w+:id="([^"]*)"/)?.[1] ?? null;
    const target = rid ? targets.get(rid) : null;
    const xml = target ? await read(`xl/${target}`) : null;
    const grid: string[][] = [];
    if (xml) {
      for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
        const r = Number(attr(row[0], "r") ?? grid.length + 1) - 1;
        if (r > 2100) break;
        const cells: string[] = [];
        for (const c of (row[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const head = `<c${c[1]}>`;
          const ref = attr(head, "r") ?? "";
          const type = attr(head, "t");
          const body = c[2] ?? "";
          const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
          let text = "";
          if (type === "s" && v !== undefined) text = shared[Number(v)] ?? "";
          else if (type === "inlineStr") text = textOf(body);
          else if (v !== undefined) text = decode(v);
          cells[ref ? colIndex(ref) : cells.length] = text;
        }
        grid[r] = Array.from(cells, (x) => x ?? "");
      }
    }
    sheets.push({ name, visible: !state || state === "visible", grid: Array.from(grid, (x) => x ?? []) });
  }
  return sheets;
}
