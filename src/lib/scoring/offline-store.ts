"use client";

import { applyOp, rejectReason, type CoreSnapshot, type EngineContext, type Op, type OpInput, type Snapshot } from "./match-engine";

/**
 * Per-match store on the umpire's device. Every action is applied and saved to
 * localStorage first (instant, survives reloads and lost signal); a background
 * loop then pushes the queued ops to the server in order.
 */

export type SyncStatus = "synced" | "syncing" | "offline" | "auth" | "conflict";

export type StoreState = {
  snapshot: Snapshot;
  pending: Op[];
  /** every timer op ever run on this device for this match (the local proof) */
  timerLog: Op[];
  status: SyncStatus;
  message: string | null;
  /** unsynced ops were discarded because the server had newer data */
  discarded: number;
};

type Saved = { snapshot: Snapshot; pending: Op[]; timerLog: Op[] };

const KEY = (id: string) => `rmt:match:${id}`;

function load(id: string): Saved | null {
  try {
    const raw = window.localStorage.getItem(KEY(id));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(id: string, s: StoreState) {
  try {
    const data: Saved = { snapshot: s.snapshot, pending: s.pending, timerLog: s.timerLog.slice(-100) };
    window.localStorage.setItem(KEY(id), JSON.stringify(data));
  } catch {
    // storage full or blocked: the in-memory state still works for this tab
  }
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export type MatchStore = ReturnType<typeof createStore>;

function createStore(matchId: string, server: CoreSnapshot, ctx: EngineContext) {
  const fromServer = (): StoreState => ({
    snapshot: { ...server, history: [] },
    pending: [],
    timerLog: [],
    status: "synced",
    message: null,
    discarded: 0,
  });

  let state: StoreState = fromServer();
  const saved = load(matchId);
  if (saved?.snapshot) {
    if (saved.snapshot.seq >= server.seq) {
      // this device is ahead of (or level with) the server: it wins
      state = { ...state, snapshot: saved.snapshot, pending: saved.pending ?? [], timerLog: saved.timerLog ?? [] };
    } else {
      // the server moved on without us (another device / organizer)
      state = { ...state, timerLog: saved.timerLog ?? [], discarded: saved.pending?.length ?? 0 };
    }
  }
  if (state.pending.length) state.status = "syncing";

  const listeners = new Set<() => void>();
  let inflight = false;
  let backoff = 1000;
  let retryTimer: number | null = null;
  let heartbeat: number | null = null;

  function set(patch: Partial<StoreState>, persist = false) {
    state = { ...state, ...patch };
    if (persist) save(matchId, state);
    listeners.forEach((l) => l());
  }

  function schedule(ms: number) {
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      void flush();
    }, ms);
  }

  async function flush() {
    if (inflight || !state.pending.length) {
      if (!state.pending.length && state.status !== "conflict") set({ status: "synced", message: null });
      return;
    }
    if (state.status === "conflict") return;
    inflight = true;
    if (state.status !== "auth") set({ status: "syncing" });
    const batch = state.pending.slice(0, 100);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`/api/umpire/matches/${matchId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: batch }),
        signal: controller.signal,
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { syncedSeq?: number; error?: string; code?: string };
      if (res.ok && typeof body.syncedSeq === "number") {
        const done = body.syncedSeq;
        backoff = 1000;
        set({ pending: state.pending.filter((o) => o.seq > done), message: null }, true);
        if (state.pending.length) {
          inflight = false;
          return flush();
        }
        set({ status: "synced" });
      } else if (body.code === "auth") {
        set({ status: "auth", message: body.error ?? "Sign in again to sync." });
        schedule(15000);
      } else if (body.code === "stale" || body.code === "finished") {
        set({ status: "conflict", message: body.error ?? "This match was changed elsewhere." });
      } else {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
    } catch {
      set({ status: "offline" });
      backoff = Math.min(backoff * 2, 30000);
      schedule(backoff);
    } finally {
      window.clearTimeout(timeout);
      inflight = false;
    }
  }

  function dispatch(input: OpInput): string | null {
    const reason = rejectReason(state.snapshot, input);
    if (reason) return reason;
    const op = { ...input, id: uuid(), seq: state.snapshot.seq + 1, at: new Date().toISOString() } as Op;
    const { snapshot, op: done } = applyOp(state.snapshot, op, ctx);
    set(
      {
        snapshot,
        pending: [...state.pending, done],
        timerLog: done.type === "timer" ? [...state.timerLog, done] : state.timerLog,
      },
      true
    );
    void flush();
    return null;
  }

  function wake() {
    backoff = 1000;
    void flush();
  }

  const onVisible = () => document.visibilityState === "visible" && wake();

  return {
    getState: () => state,
    dispatch,
    retry: wake,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        window.addEventListener("online", wake);
        document.addEventListener("visibilitychange", onVisible);
        heartbeat = window.setInterval(() => void flush(), 15000);
        void flush();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          window.removeEventListener("online", wake);
          document.removeEventListener("visibilitychange", onVisible);
          if (heartbeat) window.clearInterval(heartbeat);
          if (retryTimer) window.clearTimeout(retryTimer);
        }
      };
    },
    /** after the umpire signs in again */
    resumeAfterAuth() {
      set({ status: "syncing", message: null });
      wake();
    },
  };
}

const stores = new Map<string, MatchStore>();

export function getMatchStore(matchId: string, server: CoreSnapshot, ctx: EngineContext) {
  // never share a store between server requests
  if (typeof window === "undefined") return createStore(matchId, server, ctx);
  let s = stores.get(matchId);
  // the server moved past this tab's copy (another device): start over from it
  if (s && server.seq > s.getState().snapshot.seq) s = undefined;
  if (!s) {
    s = createStore(matchId, server, ctx);
    stores.set(matchId, s);
  }
  return s;
}

/** Forget the cached store so the next visit re-reads server + device state. */
export function dropMatchStore(matchId: string) {
  stores.delete(matchId);
}
