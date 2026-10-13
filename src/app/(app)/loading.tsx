import {
  LoadingRegion,
  SkeletonList,
  SkeletonPageHeader,
  SkeletonStats,
} from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <LoadingRegion className="space-y-12">
      <SkeletonPageHeader />
      <SkeletonStats />
      <SkeletonList />
    </LoadingRegion>
  );
}
