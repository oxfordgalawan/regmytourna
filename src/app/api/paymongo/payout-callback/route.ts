import { NextResponse } from "next/server";

/** PayMongo batch transfer webhooks land here (optional monitoring). */
export async function POST() {
  return NextResponse.json({ received: true });
}