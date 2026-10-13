import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export default function TournamentDetailLoading() {
  return (
    <LoadingRegion label="Loading tournament">
      <div className="border-b border-line">
        <div className="mx-auto max-w-7xl space-y-5 px-4 pt-8 pb-12 sm:px-6 lg:pb-16">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-8 h-6 w-40 rounded-full" />
          <Skeleton className="h-20 w-full max-w-3xl" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-10">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </LoadingRegion>
  );
}
