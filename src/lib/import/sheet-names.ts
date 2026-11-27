/** Excel tab names: max 31 chars, no : \ / ? * [ ], unique case-insensitively. */
export function excelSheetNames(displayNames: string[], reserved: string[] = []): string[] {
  const used = new Set(reserved.map((n) => n.toLowerCase()));
  return displayNames.map((display) => {
    const base =
      display.replace(/[:\\/?*[\]]/g, "-").replace(/^'+|'+$/g, "").slice(0, 31).trim() || "Category";
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      name = `${base.slice(0, 31 - ` (${n})`.length)} (${n})`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}