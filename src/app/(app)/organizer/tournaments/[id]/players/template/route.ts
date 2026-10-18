import { getOptionalUser } from "@/lib/auth/require-user";
import { isOrganizerForTournament } from "@/lib/auth/require-organizer";
import { loadImportContext } from "@/lib/import/server";
import { buildPlayersTemplate } from "@/lib/import/xlsx";

/** Downloads an Excel template for this event: a Players sheet with a category dropdown. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOptionalUser();
  if (!user || !(await isOrganizerForTournament(user.id, id, user))) {
    return new Response("Not found", { status: 404 });
  }
  const { tournament, categories } = await loadImportContext(id);
  if (!tournament) return new Response("Not found", { status: 404 });

  const file = await buildPlayersTemplate({ name: tournament.name }, categories);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${tournament.slug}-players.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
