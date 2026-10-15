/** Matches umpires can claim or see on the queue (both sides known, not a bye). */
export function isPlayableMatch(m: {
  is_bye?: boolean | null;
  is_conditional?: boolean | null;
  team_a_registration_id?: string | null;
  team_b_registration_id?: string | null;
  stage?: string | null;
  status?: string | null;
}) {
  if (m.is_bye) return false;
  if (m.is_conditional && !m.team_a_registration_id) return false;
  if (m.stage && m.status === "scheduled" && (!m.team_a_registration_id || !m.team_b_registration_id)) {
    return false;
  }
  return true;
}

export function sortQueueMatches<
  T extends { umpire_queue_order?: number | null; match_number?: number | null },
>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const ao = a.umpire_queue_order;
    const bo = b.umpire_queue_order;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    return (a.match_number ?? 99999) - (b.match_number ?? 99999);
  });
}
