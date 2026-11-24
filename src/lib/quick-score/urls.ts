import { getServerEnv } from "@/lib/env/server";

export function quickScoreTvUrl(token: string) {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/umpire-tool/s/${token}/tv`;
}

export function quickScoreScorerPath(token: string) {
  return `/umpire-tool/s/${token}`;
}