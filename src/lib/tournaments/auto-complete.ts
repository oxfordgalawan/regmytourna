import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Today's date (YYYY-MM-DD) in the Philippines, where events are held. */
export function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

/** Statuses that should roll over to "completed" once the event's last day has passed. */
const ACTIVE = ["published", "registration_open", "registration_closed", "in_progress"];

let lastRun = 0;
let running: Promise<void> | null = null;

/**
 * Marks events whose last day (end date, or start date for one-day events) is
 * before today as completed. Runs at most every few minutes per server, before
 * event lists and pages are read, so nothing past-dated shows as upcoming.
 * Drafts and cancelled events are left alone.
 */
export function completePastTournaments(): Promise<void> {
  if (running) return running;
  if (Date.now() - lastRun < 5 * 60_000) return Promise.resolve();
  running = (async () => {
    try {
      const admin = createAdminClient();
      const today = manilaToday();
      await Promise.all([
        admin.from("tournaments").update({ status: "completed" }).in("status", ACTIVE).lt("end_date", today),
        admin.from("tournaments").update({ status: "completed" }).in("status", ACTIVE).is("end_date", null).lt("start_date", today),
      ]);
      lastRun = Date.now();
    } catch {
      // listing still works; we'll try again on the next read
    } finally {
      running = null;
    }
  })();
  return running;
}
