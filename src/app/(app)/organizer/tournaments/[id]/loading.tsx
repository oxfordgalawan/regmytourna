import { LoadingRegion, Skeleton, SkeletonList } from "@/components/ui/skeleton";

/** Tab panel placeholder — the event header and tabs stay on screen. */
export default function TournamentTabLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-full sm:w-72" />
        <Skeleton className="h-10 w-48 rounded-full" />
      </div>
      <SkeletonList rows={5} />
    </LoadingRegion>
  );
}
