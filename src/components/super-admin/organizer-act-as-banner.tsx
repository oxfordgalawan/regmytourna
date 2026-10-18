import { requireUser } from "@/lib/auth/require-user";
import { getOrganizerActAsContext } from "@/lib/auth/organizer-act-as";
import { clearOrganizerActAsAction } from "@/app/actions/super-admin";
import { Button } from "@/components/ui/button";

export async function OrganizerActAsBanner() {
  const user = await requireUser();
  const ctx = await getOrganizerActAsContext(user);
  if (!ctx) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/40 bg-brass/10 px-4 py-3">
      <p className="text-sm text-bone">
        Viewing as <span className="font-semibold">{ctx.fullName}</span>
        {ctx.email ? <span className="text-muted-foreground"> · {ctx.email}</span> : null}
      </p>
      <form action={clearOrganizerActAsAction}>
        <Button type="submit" variant="outline" size="sm">
          Exit view
        </Button>
      </form>
    </div>
  );
}
