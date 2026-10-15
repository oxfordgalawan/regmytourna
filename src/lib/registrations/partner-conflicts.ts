import { createAdminClient } from "@/lib/supabase/admin";

const ACTIVE = ["confirmed", "awaiting_payment", "pending", "awaiting_partner"];

export function normalizePartnerEmail(email: string) {
  return email.trim().toLowerCase();
}

async function activeRegistrationIds(admin: ReturnType<typeof createAdminClient>, filter: {
  tournamentId: string;
  divisionId?: string;
  excludeDivisionId?: string;
}) {
  let q = admin
    .from("registrations")
    .select("id, division_id, registered_by")
    .eq("tournament_id", filter.tournamentId)
    .in("status", ACTIVE);
  if (filter.divisionId) q = q.eq("division_id", filter.divisionId);
  if (filter.excludeDivisionId) q = q.neq("division_id", filter.excludeDivisionId);
  const { data } = await q;
  return data ?? [];
}

export async function checkPartnerEmailConflict(params: {
  tournamentId: string;
  divisionId: string;
  partnerEmail: string;
  excludeUserId: string;
}) {
  const email = normalizePartnerEmail(params.partnerEmail);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { blocked: undefined as string | undefined, warnings: [] as string[] };
  }

  const admin = createAdminClient();
  const { data: partnerUserId } = await admin.rpc("auth_user_id_for_email", { p_email: email });

  if (partnerUserId && partnerUserId === params.excludeUserId) {
    return {
      blocked:
        "That\u2019s your own email. Leave partner email blank, or enter your partner\u2019s address.",
      warnings: [] as string[],
    };
  }

  const sameDivisionRegs = await activeRegistrationIds(admin, {
    tournamentId: params.tournamentId,
    divisionId: params.divisionId,
  });
  const sameDivisionIds = sameDivisionRegs.map((r) => r.id);

  if (sameDivisionIds.length) {
    const { count: guestCount } = await admin
      .from("registration_players")
      .select("id", { count: "exact", head: true })
      .in("registration_id", sameDivisionIds)
      .ilike("guest_email", email);
    if ((guestCount ?? 0) > 0) {
      return {
        blocked:
          "That partner email is already on another entry in this category. They cannot join two teams in the same division.",
        warnings: [] as string[],
      };
    }
  }

  if (partnerUserId && partnerUserId !== params.excludeUserId) {
    const primaryConflict = sameDivisionRegs.some((r) => r.registered_by === partnerUserId);
    if (primaryConflict) {
      return {
        blocked:
          "That partner is already registered in this category on another entry. Choose a different partner or category.",
        warnings: [] as string[],
      };
    }
  }

  const warnings: string[] = [];
  const otherDivisionRegs = await activeRegistrationIds(admin, {
    tournamentId: params.tournamentId,
    excludeDivisionId: params.divisionId,
  });
  const otherIds = otherDivisionRegs.map((r) => r.id);

  if (otherIds.length) {
    const { data: guestOther } = await admin
      .from("registration_players")
      .select("registration_id")
      .in("registration_id", otherIds)
      .ilike("guest_email", email);
    if (guestOther?.length) {
      const divIds = [...new Set(otherDivisionRegs.filter((r) => guestOther.some((g) => g.registration_id === r.id)).map((r) => r.division_id))];
      const { data: divs } = await admin
        .from("tournament_divisions")
        .select("name")
        .in("id", divIds);
      for (const d of divs ?? []) {
        warnings.push(`This person is already listed as a partner in ${d.name}.`);
      }
    }
  }

  if (partnerUserId && partnerUserId !== params.excludeUserId) {
    const primaryOther = otherDivisionRegs.filter((r) => r.registered_by === partnerUserId);
    if (primaryOther.length) {
      const divIds = [...new Set(primaryOther.map((r) => r.division_id))];
      const { data: divs } = await admin
        .from("tournament_divisions")
        .select("name")
        .in("id", divIds);
      for (const d of divs ?? []) {
        warnings.push(`This person is already registered in ${d.name}.`);
      }
    }
  }

  return { blocked: undefined as string | undefined, warnings: [...new Set(warnings)] };
}
