import {
  clientIpFromRequest,
  isStarpagoCallbackIpAllowed,
  isStarpagoFailedStatus,
  isStarpagoPaidStatus,
  starpagoAppSecret,
  starpagoVerify,
} from "@/lib/starpago";

export async function GET() {
  if (!starpagoAppSecret()) {
    return new Response("not configured", { status: 503 });
  }
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  const secret = starpagoAppSecret();
  if (!secret) {
    return new Response("not configured", { status: 503 });
  }

  const ip = clientIpFromRequest(request);
  if (!isStarpagoCallbackIpAllowed(ip)) {
    console.warn("[starpago/payout-notify] rejected ip:", ip);
    return new Response("forbidden", { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (!starpagoVerify(payload, secret)) {
    console.warn("[starpago/payout-notify] invalid signature");
    return new Response("invalid signature", { status: 401 });
  }

  const merOrderNo =
    typeof payload.merOrderNo === "string" ? payload.merOrderNo.trim() : "";
  const orderStatus = Number(payload.orderStatus);

  console.info("[starpago/payout-notify] ack", {
    merOrderNo,
    orderStatus,
    paid: isStarpagoPaidStatus(orderStatus),
    failed: isStarpagoFailedStatus(orderStatus),
  });

  return new Response("success", { status: 200 });
}
