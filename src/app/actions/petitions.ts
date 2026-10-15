"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPetitionEligibilityForUser } from "@/lib/petitions/eligibility";
import { signPetitionProofPaths } from "@/lib/petitions/signed-urls";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import { relationOne } from "@/lib/supabase/relations";
import { sendPetitionDecisionEmail } from "@/lib/email/send";

function expectedPathPrefix(tournamentId: string, registrationId: string) {
  return `${tournamentId}/${registrationId}/`;
}

async function verifyProofPaths(
  admin: ReturnType<typeof createAdminClient>,
  tournamentId: string,
  registrationId: string,
  paths: string[]
) {
  const prefix = expectedPathPrefix(tournamentId, registrationId);
  if (paths.length < 1 || paths.length > 3) return "Attach 1 to 3 proof images.";
  for (const p of paths) {
    if (!p.startsWith(prefix) || p.includes("..")) return "Invalid proof path.";
    const folder = p.slice(prefix.length);
    if (!folder || folder.includes("/")) return "Invalid proof path.";
  }
  for (const p of paths) {
    const { data, error } = await admin.storage.from("petition-proofs").download(p);
    if (error || !data) return "One or more proof images could not be verified. Re-upload and try again.";
  }
  return null;
}

export async function getMyPetitionEligibilityAction(tournamentSlug: string, divisionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { eligible: false as const, reason: "not_signed_in" as const };

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, is_public")
    .eq("slug", tournamentSlug)
    .maybeSingle();
  if (!tournament?.is_public) return { error: "Tournament not found." };

  return getPetitionEligibilityForUser(user.id, tournament.id, divisionId);
}

export type SubmitPetitionInput = {
  registrationId: string;
  reason: string;
  imagePaths: Array<{
    storagePath: string;
    contentType: string;
    byteSize: number;
    width: number;
    height: number;
  }>;
};

export async function submitEntryPetitionAction(input: SubmitPetitionInput) {
  const user = await requireUser();
  const reason = input.reason.trim();
  if (reason.length < 10) return { error: "Please describe your request in at least 10 characters." };

  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select(`id, tournament_id, division_id, status, ${REGISTRATION_PLAYERS_SELECT}`)
    .eq("id", input.registrationId)
    .maybeSingle();

  if (!reg) return { error: "Registration not found." };

  const eligibility = await getPetitionEligibilityForUser(user.id, reg.tournament_id, reg.division_id);
  if (!eligibility.eligible || eligibility.registrationId !== input.registrationId) {
    return { error: "You can't submit a petition for this entry right now." };
  }

  const paths = input.imagePaths.map((i) => i.storagePath);
  const pathError = await verifyProofPaths(admin, reg.tournament_id, reg.id, paths);
  if (pathError) return { error: pathError };

  const { data: petition, error: insertError } = await admin
    .from("entry_petitions")
    .insert({
      registration_id: reg.id,
      tournament_id: reg.tournament_id,
      division_id: reg.division_id,
      submitted_by: user.id,
      reason,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") return { error: "You already have a petition under review." };
    return { error: insertError.message };
  }

  const imageRows = input.imagePaths.map((img, sort_order) => ({
    petition_id: petition.id,
    storage_path: img.storagePath,
    sort_order,
    content_type: img.contentType,
    byte_size: img.byteSize,
    width: img.width,
    height: img.height,
  }));

  const { error: imgError } = await admin.from("entry_petition_images").insert(imageRows);
  if (imgError) {
    await admin.from("entry_petitions").delete().eq("id", petition.id);
    return { error: imgError.message };
  }

  const { data: tournament } = await admin.from("tournaments").select("slug").eq("id", reg.tournament_id).single();
  if (tournament?.slug) revalidatePath(`/tournaments/${tournament.slug}`);

  return { ok: true as const, petitionId: petition.id };
}

export type OrganizerPetitionRow = {
  id: string;
  status: string;
  reason: string;
  reviewerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  divisionName: string;
  entryName: string;
  submitterName: string;
  imageCount: number;
  images: Array<{ id: string; storagePath: string; sortOrder: number }>;
};

export async function listPetitionsForOrganizerAction(tournamentId: string) {
  await requireOrganizerForTournament(tournamentId);
  const admin = createAdminClient();

  const { data: petitions, error } = await admin
    .from("entry_petitions")
    .select(
      `
      id, status, reason, reviewer_note, created_at, reviewed_at, submitted_by,
      tournament_divisions(name),
      registrations(${REGISTRATION_PLAYERS_SELECT}),
      entry_petition_images(id, storage_path, sort_order)
    `
    )
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const submitterIds = [...new Set((petitions ?? []).map((p) => p.submitted_by as string))];
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", submitterIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Player"]));

  const rows: OrganizerPetitionRow[] = (petitions ?? []).map((p) => {
    const division = relationOne(p.tournament_divisions) as { name: string } | null;
    const images = (p.entry_petition_images ?? []) as Array<{
      id: string;
      storage_path: string;
      sort_order: number;
    }>;
    images.sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: p.id,
      status: p.status,
      reason: p.reason,
      reviewerNote: p.reviewer_note,
      createdAt: p.created_at,
      reviewedAt: p.reviewed_at,
      divisionName: division?.name ?? "—",
      entryName: registrationName(relationOne(p.registrations) ?? {}),
      submitterName: nameById.get(p.submitted_by) ?? "Player",
      imageCount: images.length,
      images: images.map((img) => ({
        id: img.id,
        storagePath: img.storage_path,
        sortOrder: img.sort_order,
      })),
    };
  });

  return { rows };
}

export async function getPetitionProofSignedUrlsAction(tournamentId: string, paths: string[]) {
  await requireOrganizerForTournament(tournamentId);
  const prefix = `${tournamentId}/`;
  const safe = paths.filter((p) => p.startsWith(prefix) && !p.includes(".."));
  const signed = await signPetitionProofPaths(safe);
  return { urls: Object.fromEntries(signed) };
}

export async function reviewPetitionAction(
  tournamentId: string,
  petitionId: string,
  status: "approved" | "rejected",
  reviewerNote?: string
) {
  const user = await requireOrganizerForTournament(tournamentId);
  const admin = createAdminClient();

  const { data: petition } = await admin
    .from("entry_petitions")
    .select("id, status, submitted_by, tournament_id, division_id, reason")
    .eq("id", petitionId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  if (!petition) return { error: "Petition not found." };
  if (petition.status !== "pending") return { error: "This petition was already reviewed." };

  const note = reviewerNote?.trim() || null;
  const { error } = await admin
    .from("entry_petitions")
    .update({
      status,
      reviewer_note: note,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", petitionId);

  if (error) return { error: error.message };

  const [{ data: tournament }, { data: division }] = await Promise.all([
    admin.from("tournaments").select("name, slug").eq("id", tournamentId).single(),
    admin.from("tournament_divisions").select("name").eq("id", petition.division_id).single(),
  ]);

  const { data: authUser } = await admin.auth.admin.getUserById(petition.submitted_by);
  const email = authUser?.user?.email;
  if (email && tournament) {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await sendPetitionDecisionEmail({
      to: email,
      tournamentName: tournament.name,
      divisionName: division?.name ?? "Category",
      status,
      note,
      eventUrl: `${base}/tournaments/${tournament.slug}`,
    });
  }

  revalidatePath(`/organizer/tournaments/${tournamentId}/petitions`);
  if (tournament?.slug) revalidatePath(`/tournaments/${tournament.slug}`);

  return { ok: true as const };
}
