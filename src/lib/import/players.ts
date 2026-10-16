import { tidyPersonName } from "../registrations/name";

/**
 * Player-list import for bracket-only events. Pure functions: turn a sheet,
 * CSV or pasted rows into entries, then check them against the event's
 * categories before anything is saved.
 */

export type RawRow = {
  row: number;
  category: string;
  p1: string;
  p2: string;
  /** optional; only read if an older file still has a Seed column */
  seed: string;
  /** which sheet the row came from (one sheet per category) */
  sheet?: string;
};

export type ImportCategory = {
  id: string;
  name: string;
  format: string;
  capacity: number | null;
  drawStarted: boolean;
};

export type CheckedRow = {
  row: number;
  sheet?: string;
  category: string;
  divisionId: string | null;
  p1: string;
  p2: string;
  seed: number | null;
  /** ok = will import; skip = already in the event; error = needs fixing */
  status: "ok" | "skip" | "error";
  errors: string[];
  warnings: string[];
};

export type CategorySummary = {
  divisionId: string;
  name: string;
  format: string;
  adding: number;
  existing: number;
  capacity: number | null;
  /** entries after import, given the chosen mode */
  total: number;
  overCapacity: boolean;
  drawStarted: boolean;
};

export type ImportPreview = {
  rows: CheckedRow[];
  categories: CategorySummary[];
  ok: number;
  skipped: number;
  errors: number;
};

export const MAX_IMPORT_ROWS = 2000;

const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/ /g, " ")
    .trim();

const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/[·•|–—\-_/]+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Same team regardless of who's listed first. */
export const teamKey = (names: string[]) =>
  names
    .map((n) => key(n))
    .filter(Boolean)
    .sort()
    .join(" + ");

const HEADERS = {
  category: ["category", "division", "event", "bracket"],
  p1: ["player 1", "player1", "player", "name", "player name", "team captain"],
  p2: ["player 2", "player2", "partner", "player 2 doubles", "partner name"],
  seed: ["seed", "seeding", "rank"],
};

function headerIndex(cells: string[]) {
  const norm = cells.map((c) => key(c.replace(/\(.*?\)/g, "")));
  const find = (names: string[]) => norm.findIndex((c) => names.includes(c));
  const category = find(HEADERS.category);
  if (category < 0) return null;
  return { category, p1: find(HEADERS.p1), p2: find(HEADERS.p2), seed: find(HEADERS.seed) };
}

/** Grid of cell strings → rows, using a header row if there is one (else Category, P1, P2, Seed). */
export function rowsFromGrid(grid: string[][], firstRowNumber = 1): RawRow[] {
  let start = 0;
  let cols = { category: 0, p1: 1, p2: 2, seed: 3 };
  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    const h = headerIndex(grid[i]);
    if (h) {
      start = i + 1;
      cols = { category: h.category, p1: h.p1 >= 0 ? h.p1 : h.category + 1, p2: h.p2, seed: h.seed };
      break;
    }
  }
  const out: RawRow[] = [];
  for (let i = start; i < grid.length; i++) {
    const r = grid[i];
    const cell = (c: number) => (c >= 0 ? clean(r[c]) : "");
    const row = { row: firstRowNumber + i, category: cell(cols.category), p1: cell(cols.p1), p2: cell(cols.p2), seed: cell(cols.seed) };
    if (!row.category && !row.p1 && !row.p2) continue; // blank line
    out.push(row);
  }
  return out;
}

/**
 * One category's sheet (or pasted rows for one category): Player 1, Player 2.
 * A title row and a "Player 1 | Player 2" header are skipped if present.
 */
export function rowsFromCategoryGrid(grid: string[][], category: string, sheet?: string): RawRow[] {
  let start = 0;
  let cols = { p1: 0, p2: 1, seed: -1 };
  for (let i = 0; i < Math.min(grid.length, 6); i++) {
    const norm = grid[i].map((c) => key(clean(c).replace(/\(.*?\)/g, "")));
    const p1 = norm.findIndex((c) => HEADERS.p1.includes(c));
    if (p1 >= 0) {
      start = i + 1;
      cols = {
        p1,
        p2: norm.findIndex((c) => HEADERS.p2.includes(c)),
        seed: norm.findIndex((c) => HEADERS.seed.includes(c)),
      };
      break;
    }
  }
  const title = key(category);
  const out: RawRow[] = [];
  for (let i = start; i < grid.length; i++) {
    const r = grid[i];
    const cell = (c: number) => (c >= 0 ? clean(r[c]) : "");
    const p1 = cell(cols.p1);
    const p2 = cell(cols.p2);
    if (!p1 && !p2) continue;
    if (start === 0 && i < 2 && key(p1) === title) continue; // the sheet's title row
    out.push({ row: i + 1, category, p1, p2, seed: cell(cols.seed), sheet });
  }
  return out;
}

/** CSV or rows pasted from Excel / Google Sheets (tab-separated). */
export function gridFromText(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const tab = lines.some((l) => l.includes("\t"));
  if (tab) return lines.map((l) => l.split("\t"));
  // minimal CSV with quotes
  const rows: string[][] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === "," || ch === ";") {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function suggest(name: string, categories: ImportCategory[]) {
  const k = key(name);
  let best: { name: string; d: number } | null = null;
  for (const c of categories) {
    const ck = key(c.name);
    const d = ck.includes(k) || k.includes(ck) ? 1 : distance(k, ck);
    if (!best || d < best.d) best = { name: c.name, d };
  }
  return best && best.d <= Math.max(3, Math.floor(k.length / 3)) ? best.name : null;
}

/**
 * Checks every row. `existing` maps divisionId → team keys already in the event.
 * In "replace" mode existing entries don't count as duplicates or toward capacity.
 */
export function validateImport(
  raw: RawRow[],
  categories: ImportCategory[],
  existing: Map<string, Set<string>>,
  mode: "add" | "replace"
): ImportPreview {
  const byKey = new Map(categories.map((c) => [key(c.name), c]));
  const seenTeam = new Map<string, number>(); // divisionId|team → row
  const seenPlayer = new Map<string, number>(); // divisionId|player → row
  const seeds = new Map<string, Set<number>>();

  const rows: CheckedRow[] = raw.slice(0, MAX_IMPORT_ROWS).map((r) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const cat = byKey.get(key(r.category)) ?? null;
    const p1 = r.p1 ? tidyPersonName(r.p1) : "";
    let p2 = r.p2 ? tidyPersonName(r.p2) : "";
    let seed: number | null = null;

    if (!r.category) errors.push("Category is empty.");
    else if (!cat) {
      const s = suggest(r.category, categories);
      errors.push(`No category called “${r.category}”.${s ? ` Did you mean “${s}”?` : ""}`);
    } else if (cat.drawStarted) errors.push(`${cat.name}'s draw has started — reset it to add players.`);

    if (!p1) errors.push("Player 1 is empty.");
    if (cat?.format === "doubles" && !p2) errors.push("Doubles needs Player 2 (the partner).");
    if (cat && cat.format !== "doubles" && p2) {
      warnings.push("Player 2 is ignored in a singles category.");
      p2 = "";
    }
    if (p1 && p2 && key(p1) === key(p2)) errors.push("Player 1 and Player 2 are the same person.");

    if (r.seed) {
      const n = Number(r.seed);
      if (Number.isInteger(n) && n > 0 && n < 1000) seed = n;
      else warnings.push(`Seed “${r.seed}” isn't a whole number — left unseeded.`);
    }

    let status: CheckedRow["status"] = errors.length ? "error" : "ok";
    if (cat && status === "ok") {
      const team = teamKey([p1, p2]);
      const dupe = seenTeam.get(`${cat.id}|${team}`);
      if (dupe) {
        errors.push(`Same entry as row ${dupe}.`);
        status = "error";
      } else if (mode === "add" && existing.get(cat.id)?.has(team)) {
        warnings.push("Already in this category — skipped.");
        status = "skip";
      } else {
        seenTeam.set(`${cat.id}|${team}`, r.row);
        for (const p of [p1, p2].filter(Boolean)) {
          const other = seenPlayer.get(`${cat.id}|${key(p)}`);
          if (other) {
            errors.push(`${p} is already on row ${other} in this category.`);
            status = "error";
          } else seenPlayer.set(`${cat.id}|${key(p)}`, r.row);
        }
        if (seed && status === "ok") {
          const set = seeds.get(cat.id) ?? new Set<number>();
          if (set.has(seed)) warnings.push(`Seed ${seed} is used twice in this category.`);
          set.add(seed);
          seeds.set(cat.id, set);
        }
      }
    }

    return { row: r.row, sheet: r.sheet, category: cat?.name ?? r.category, divisionId: cat?.id ?? null, p1, p2, seed, status, errors, warnings };
  });

  const summaries: CategorySummary[] = categories
    .map((c) => {
      const adding = rows.filter((r) => r.divisionId === c.id && r.status === "ok").length;
      const touched = rows.some((r) => r.divisionId === c.id);
      if (!touched) return null;
      const existingCount = existing.get(c.id)?.size ?? 0;
      const total = (mode === "replace" ? 0 : existingCount) + adding;
      return {
        divisionId: c.id,
        name: c.name,
        format: c.format,
        adding,
        existing: existingCount,
        capacity: c.capacity,
        total,
        overCapacity: Boolean(c.capacity && total > c.capacity),
        drawStarted: c.drawStarted,
      };
    })
    .filter((c): c is CategorySummary => c !== null);

  return {
    rows,
    categories: summaries,
    ok: rows.filter((r) => r.status === "ok").length,
    skipped: rows.filter((r) => r.status === "skip").length,
    errors: rows.filter((r) => r.status === "error").length,
  };
}
