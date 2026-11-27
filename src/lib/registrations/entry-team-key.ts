/** Stable identity for a roster slot within a division (primary account + guest emails). */
export function entryTeamKey(
  players: Array<{ user_id?: string | null; guest_email?: string | null }>,
  accountEmails?: Map<string, string>
) {
  const tokens: string[] = [];
  for (const p of players) {
    if (p.user_id) tokens.push(`u:${p.user_id}`);
    const em = (p.user_id && accountEmails?.get(p.user_id)) ?? p.guest_email;
    if (em) tokens.push(`e:${em.trim().toLowerCase()}`);
  }
  return [...new Set(tokens)].sort().join("|");
}

export function divisionTeamKey(divisionId: string, teamKey: string) {
  return `${divisionId}\0${teamKey}`;
}

export type PaymentSlice = {
  method: string;
  status: string;
  amount_cents: number;
  recorded_by: string | null;
};

export function sumPaidCents(payments: PaymentSlice[]) {
  return payments.filter((p) => p.status === "paid").reduce((n, p) => n + p.amount_cents, 0);
}

/** Paid totals per division+team, counting payments on every registration for that slot. */
export function buildDivisionTeamPaidCents(
  regs: Array<{
    id: string;
    division_id: string;
    players: Array<{ user_id?: string | null; guest_email?: string | null }>;
  }>,
  accountEmails: Map<string, string>,
  paymentsByRegistrationId: Map<string, PaymentSlice[]>
) {
  const paid = new Map<string, number>();
  const payments = new Map<string, PaymentSlice[]>();
  for (const r of regs) {
    const tk = divisionTeamKey(r.division_id, entryTeamKey(r.players, accountEmails));
    const rows = paymentsByRegistrationId.get(r.id) ?? [];
    if (rows.length) {
      const merged = payments.get(tk) ?? [];
      merged.push(...rows);
      payments.set(tk, merged);
    }
    const slice = sumPaidCents(rows);
    if (slice > 0) paid.set(tk, (paid.get(tk) ?? 0) + slice);
  }
  return { paidCentsByDivisionTeam: paid, paymentsByDivisionTeam: payments };
}