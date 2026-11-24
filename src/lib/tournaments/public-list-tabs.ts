/** Shared status tabs for /tournaments and /explore. */

export const PUBLIC_LIST_STATUS_TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live today" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
] as const;

export const DEFAULT_PUBLIC_LIST_STATUS = "upcoming" as const;

export function effectivePublicListStatus(status?: string): string {
  if (!status || status === "") return DEFAULT_PUBLIC_LIST_STATUS;
  return status;
}

/** Value passed to `listPublicTournaments({ status })`; `all` = no status filter. */
export function statusForListQuery(tabStatus: string): string | undefined {
  if (tabStatus === "all") return undefined;
  return tabStatus;
}

export function hasNonDefaultListFilters(opts: {
  q?: string;
  city?: string;
  sport?: string;
  status?: string;
}): boolean {
  const tab = effectivePublicListStatus(opts.status);
  return Boolean(opts.q || opts.city || opts.sport || tab !== DEFAULT_PUBLIC_LIST_STATUS);
}