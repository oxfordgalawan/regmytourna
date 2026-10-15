import { createAdminClient } from "@/lib/supabase/admin";

const TTL_SECONDS = 300;

export async function signPetitionProofPaths(paths: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const out = new Map<string, string>();
  await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await admin.storage.from("petition-proofs").createSignedUrl(path, TTL_SECONDS);
      if (!error && data?.signedUrl) out.set(path, data.signedUrl);
    })
  );
  return out;
}
