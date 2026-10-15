import {
  clientIpFromRequest,
  isStarpagoCallbackIpAllowed,
  isStarpagoExpiredStatus,
  isStarpagoFailedStatus,
  isStarpagoPaidStatus,
  isStarpagoRefundedStatus,
  queryPayinOrder,
  starpagoAppSecret,
  starpagoVerify,
} from "@/lib/starpago";

/** Provider / form may probe callback URL with GET before POST notifies are enabled. */
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
    console.warn("[starpago/notify] rejected ip:", ip);
    return new Response("forbidden", { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (!starpagoVerify(payload, secret)) {
    console.warn("[starpago/notify] invalid signature");
    return new Response("invalid signature", { status: 401 });
  }

  const merOrderNo =
    typeof payload.merOrderNo === "string" ? payload.merOrderNo : null;
  const orderStatus = Number(payload.orderStatus);

  console.info("[starpago/notify] ack", {
    merOrderNo,
    orderStatus,
  });

  if (!merOrderNo) {
    return new Response("success", { status: 200 });
  }

  if (isStarpagoPaidStatus(orderStatus)) {
    try {
      const queried = await queryPayinOrder(merOrderNo);
      console.info("[starpago/notify] query confirm", {
        merOrderNo,
        orderStatus: queried.orderStatus,
        amount: queried.amount,
      });
    } catch (err) {
      console.error("[starpago/notify] query error", err);
      return new Response("retry", { status: 500 });
    }
  } else if (
    isStarpagoExpiredStatus(orderStatus) ||
    isStarpagoFailedStatus(orderStatus) ||
    isStarpagoRefundedStatus(orderStatus)
  ) {
    console.info("[starpago/notify] terminal status", { merOrderNo, orderStatus });
  }

  return new Response("success", { status: 200 });
}
