"use client";

import { useState } from "react";
import Link from "next/link";
import { GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/format";
import type { ChallongeAccount } from "@/types/database";

const statusMessages: Record<string, string> = {
  connected: "Challonge account connected successfully.",
  denied: "Authorization was denied.",
  expired_state: "Session expired. Please try connecting again.",
  already_linked: "This Challonge account is already linked to another RegMyTourna user.",
  error: "Something went wrong during connection.",
  not_configured: "Challonge OAuth is not configured on this environment.",
  invalid: "Invalid OAuth response.",
};

export function ChallongeConnectionCard({
  account,
  configured,
  status,
}: {
  account: Pick<
    ChallongeAccount,
    "challonge_user_id" | "username" | "connected_at" | "scopes"
  > | null;
  configured: boolean;
  status?: string | null;
}) {
  const [loading, setLoading] = useState(false);

  async function disconnect() {
    if (!window.confirm("Disconnect Challonge? Linked brackets will stop syncing.")) return;
    setLoading(true);
    await fetch("/api/integrations/challonge/disconnect", { method: "POST" });
    window.location.reload();
  }

  return (
    <section className="max-w-3xl overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="flex gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-umber text-bone">
            <GitBranch className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-bone">Challonge</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Manage brackets and sync participants and results through RegMyTourna.
            </p>
          </div>
        </div>
        <span
          className={
            account
              ? "inline-flex items-center gap-2 rounded-full bg-bone px-3 py-1 text-xs font-medium text-ink"
              : "inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-muted-foreground"
          }
        >
          <span className={account ? "size-1.5 rounded-full bg-ink" : "size-1.5 rounded-full bg-muted-foreground"} />
          {account ? "Connected" : "Not connected"}
        </span>
      </div>

      {(status && statusMessages[status]) || !configured ? (
        <div className="space-y-3 px-6 pb-6">
          {status && statusMessages[status] && (
            <Alert variant={status === "connected" ? "default" : "destructive"}>
              <AlertDescription>{statusMessages[status]}</AlertDescription>
            </Alert>
          )}
          {!configured && (
            <Alert>
              <AlertDescription>
                Set <code className="font-mono text-xs">CHALLONGE_*</code> variables in{" "}
                <code className="font-mono text-xs">.env.local</code>. See README.
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}

      {account && (
        <dl className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
          {[
            { label: "Username", value: account.username },
            { label: "User ID", value: account.challonge_user_id },
            { label: "Connected", value: formatDateTime(account.connected_at) },
          ].map((row) => (
            <div key={row.label} className="bg-surface px-6 py-4">
              <dt className="eyebrow">{row.label}</dt>
              <dd className="mt-1.5 truncate font-mono text-sm text-bone">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-ink/30 px-6 py-4">
        {account ? (
          <>
            <Button variant="destructive" onClick={disconnect} disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Disconnect
            </Button>
            <Button asChild variant="outline" disabled={!configured}>
              <Link href="/api/integrations/challonge/connect">Reconnect</Link>
            </Button>
          </>
        ) : (
          <Button asChild disabled={!configured}>
            <Link href="/api/integrations/challonge/connect">Connect Challonge</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
