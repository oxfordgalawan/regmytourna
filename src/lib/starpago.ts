import { createHash } from "crypto";
import { getAppUrl } from "@/lib/env/server";

/** Canonical HTTPS origin for notify/return URLs (prefer www on production). */
export function starpagoAppOrigin(): string {
  const raw = getAppUrl().replace(/\/$/, "");
  if (raw === "https://regmytourna.com" || raw === "http://regmytourna.com") {
    return "https://www.regmytourna.com";
  }
  return raw;
}

/** StarPago e-wallet collection fee (platform reporting). */
export const STARPAGO_EWALLET_FEE_RATE = 0.045;
/** @deprecated use STARPAGO_EWALLET_FEE_RATE */
export const GCASH_FEE_RATE = STARPAGO_EWALLET_FEE_RATE;

export const STARPAGO_MIN_AMOUNT_PHP = 100;
export const STARPAGO_MAX_AMOUNT_PHP = 50_000;

export const STARPAGO_PAY_METHOD_GCASH = "PH_GCASH";
export const STARPAGO_PAY_METHOD_MAYA = "PH_MAYA";
export const STARPAGO_PAY_METHOD_QRPH = "PH_QRIS";

export type StarpagoMemberMethod = "gcash" | "maya";

export function parseStarpagoMemberMethod(
  input: unknown,
): StarpagoMemberMethod | null {
  const s = String(input ?? "")
    .trim()
    .toLowerCase();
  if (s === "gcash" || s === "maya") return s;
  return null;
}

export function starpagoPayMethodFromMember(
  method: StarpagoMemberMethod,
): string {
  return method === "maya"
    ? STARPAGO_PAY_METHOD_MAYA
    : STARPAGO_PAY_METHOD_GCASH;
}

export function memberMethodFromPayMethod(
  payMethod: string,
): StarpagoMemberMethod {
  return payMethod === STARPAGO_PAY_METHOD_MAYA ? "maya" : "gcash";
}

export function starpagoEwalletLabel(method: StarpagoMemberMethod): string {
  return method === "maya" ? "Maya" : "GCash";
}

/** Member audit Deposits tab: channel label for a top-up row. */
export function memberAuditDepositLabel(
  provider: "paymongo" | "starpago",
  payMethod?: string | null,
): string {
  if (provider === "paymongo") return "PayMongo QR PH";
  if (payMethod === STARPAGO_PAY_METHOD_MAYA) return "StarPago Maya";
  return "StarPago GCash";
}

export type StarpagoOrderStatus = number;

export function starpagoApiUrl(): string {
  return (
    process.env.STARPAGO_API_URL?.trim() || "https://ph.api.starpago.com"
  ).replace(/\/$/, "");
}

export function starpagoAppId(): string | undefined {
  const id = process.env.STARPAGO_APP_ID?.trim();
  return id || undefined;
}

export function starpagoAppSecret(): string | undefined {
  const s = process.env.STARPAGO_APP_SECRET?.trim();
  return s || undefined;
}

export function starpagoCallbackIps(): string[] {
  const raw =
    process.env.STARPAGO_CALLBACK_IPS?.trim() || "54.151.137.174";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function starpagoConfigured(): boolean {
  return Boolean(starpagoAppId() && starpagoAppSecret());
}

/** HTTPS relay with a fixed egress IP (StarPago allowlist). */
export function starpagoRelayUrl(): string | undefined {
  const url = process.env.STARPAGO_RELAY_URL?.trim();
  return url ? url.replace(/\/$/, "") : undefined;
}

export function starpagoRelaySecret(): string | undefined {
  const s = process.env.STARPAGO_RELAY_SECRET?.trim();
  return s || undefined;
}

export function starpagoUsesRelay(): boolean {
  return Boolean(starpagoRelayUrl());
}

function assertRelayCredentials(): void {
  if (!starpagoUsesRelay()) return;
  if (!starpagoRelaySecret()) {
    throw new Error(
      "STARPAGO_RELAY_URL is set but STARPAGO_RELAY_SECRET is missing",
    );
  }
}

function relayForwardUrl(apiPath: string, queryString?: string): string {
  const base = starpagoRelayUrl()!;
  const url = new URL(`${base}/forward`);
  url.searchParams.set("path", apiPath.startsWith("/") ? apiPath : `/${apiPath}`);
  if (queryString) url.searchParams.set("query", queryString);
  return url.toString();
}

function relayRequestHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  assertRelayCredentials();
  return {
    ...extra,
    Authorization: `Bearer ${starpagoRelaySecret()!}`,
  };
}

export function starpagoEwalletFeeForAmount(amountPhp: number): {
  fee_rate: number;
  fee_php: number;
  net_php: number;
} {
  const fee_php = Math.round(amountPhp * STARPAGO_EWALLET_FEE_RATE * 100) / 100;
  return {
    fee_rate: STARPAGO_EWALLET_FEE_RATE,
    fee_php,
    net_php: Math.round((amountPhp - fee_php) * 100) / 100,
  };
}

/** @deprecated use starpagoEwalletFeeForAmount */
export function gcashFeeForAmount(amountPhp: number): {
  fee_rate: number;
  fee_php: number;
  net_php: number;
} {
  return starpagoEwalletFeeForAmount(amountPhp);
}

export function isStarpagoPaidStatus(status: StarpagoOrderStatus): boolean {
  return status === 2 || status === 3;
}

export function isStarpagoFailedStatus(status: StarpagoOrderStatus): boolean {
  return status === -1;
}

export function isStarpagoExpiredStatus(status: StarpagoOrderStatus): boolean {
  return status === -2;
}

export function isStarpagoRefundedStatus(status: StarpagoOrderStatus): boolean {
  return status === -3;
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function parseExtraForSign(ext: unknown): string | null {
  if (!ext || typeof ext !== "object" || Array.isArray(ext)) return null;
  const record = ext as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const value = record[key];
    if (isBlank(value)) continue;
    if (value && typeof value === "object") {
      parts.push(`${key}=${JSON.stringify(value)}`);
    } else {
      parts.push(`${key}=${String(value)}`);
    }
  }
  return parts.length ? parts.join("&") : null;
}

export function starpagoSign(
  params: Record<string, unknown>,
  appSecret: string,
): string {
  const signStr = starpagoSignString(params, appSecret);
  return createHash("sha256").update(signStr, "utf8").digest("hex");
}

export function starpagoSignString(
  params: Record<string, unknown>,
  appSecret: string,
): string {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign" && !isBlank(params[k]))
    .sort();

  const parts: string[] = [];
  for (const key of keys) {
    const value = params[key];
    if (key === "extra") {
      const extraStr = parseExtraForSign(value);
      if (extraStr) parts.push(`${key}=${extraStr}`);
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      parts.push(`${key}=${JSON.stringify(value)}`);
    } else {
      parts.push(`${key}=${String(value)}`);
    }
  }
  parts.push(`key=${appSecret}`);
  return parts.join("&");
}

export function starpagoVerify(
  payload: Record<string, unknown>,
  appSecret: string,
): boolean {
  const given = payload.sign;
  if (typeof given !== "string" || !given.trim()) return false;
  const expected = starpagoSign(payload, appSecret);
  return expected === given.trim();
}

export function starpagoNotifyUrl(): string {
  return `${starpagoAppOrigin()}/api/starpago/notify`;
}

export function starpagoPayoutNotifyUrl(): string {
  return `${starpagoAppOrigin()}/api/starpago/payout-notify`;
}

export function generateMerOrderNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RMT${ts}${rand}`.slice(0, 32);
}

export function normalizePhMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("09")) return digits;
  if (digits.length === 12 && digits.startsWith("639")) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `0${digits}`;
  return null;
}

export function validateGcashPayerName(name: string): string | null {
  const t = name.trim();
  if (t.length < 2) return "Enter the name on your GCash account";
  if (t.length > 80) return "Name is too long";
  return null;
}

type StarpagoApiEnvelope<T> = {
  code: number;
  msg?: string;
  error?: string;
  data?: T;
};

export type StarpagoPayinParamsRecord = Record<string, unknown>;

export type StarpagoCreateOrderData = {
  orderStatus?: number;
  orderNo?: string;
  merOrderNo?: string;
  amount?: number;
  params?:
    | {
        paymentLink?: string;
        url?: string;
        paymentUrl?: string;
        content?: string;
        qrContent?: string;
        qrcode?: string;
        qrCode?: string;
        payMethod?: string;
        bankCode?: string;
      }
    | string;
  message?: string;
};

/** Normalize create-order `params` (object or JSON string). */
export function normalizeStarpagoPayinParams(
  raw: StarpagoCreateOrderData["params"],
): StarpagoPayinParamsRecord {
  if (raw == null) return {};
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as StarpagoPayinParamsRecord;
      }
    } catch {
      return {};
    }
    return {};
  }
  return raw as StarpagoPayinParamsRecord;
}

function pickNonEmptyString(
  record: StarpagoPayinParamsRecord,
  keys: string[],
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function isStarpagoQrPayMethod(payMethod: string): boolean {
  const u = payMethod.trim().toUpperCase();
  return u === STARPAGO_PAY_METHOD_QRPH || u.includes("QRIS") || u.includes("_QR");
}

/** Extract payment link and scannable QR payload from a create-order response. */
export function parseStarpagoPayinParams(
  data: StarpagoCreateOrderData,
  payMethod: string,
): {
  paymentLink: string;
  qrContent: string;
  paramKeys: string[];
  usedPaymentLinkAsQr: boolean;
} {
  const params = normalizeStarpagoPayinParams(data.params);
  const paramKeys = Object.keys(params);
  const paymentLink = pickNonEmptyString(params, [
    "paymentLink",
    "url",
    "paymentUrl",
  ]);
  let qrContent = pickNonEmptyString(params, [
    "content",
    "qrContent",
    "qrcode",
    "qrCode",
  ]);
  let usedPaymentLinkAsQr = false;
  if (!qrContent && isStarpagoQrPayMethod(payMethod) && paymentLink) {
    qrContent = paymentLink;
    usedPaymentLinkAsQr = true;
  }
  return { paymentLink, qrContent, paramKeys, usedPaymentLinkAsQr };
}

export type StarpagoQueryOrderData = {
  orderStatus: number;
  orderNo: string;
  merOrderNo: string;
  amount: number;
  currency?: string;
  sign?: string;
  message?: string;
};

export type StarpagoBalanceData = {
  currency?: string;
  payinValue?: number;
  payoutValue?: number;
  disableValue?: number;
  sign?: string;
};

export const STARPAGO_START_ERROR =
  "Payment could not start. Try again later.";

/** @deprecated use STARPAGO_START_ERROR or method-specific copy in UI */
export const GCASH_START_ERROR = STARPAGO_START_ERROR;

export type StarpagoConnectivity = {
  reachable: boolean;
  httpStatus?: number;
  cfRay?: string | null;
  apiCode?: number;
  apiMsg?: string;
};

export class StarpagoRequestError extends Error {
  readonly httpStatus?: number;
  readonly apiCode?: number;
  readonly apiMsg?: string;
  readonly cfRay?: string | null;
  readonly contentType?: string | null;

  constructor(
    message: string,
    opts?: {
      httpStatus?: number;
      apiCode?: number;
      apiMsg?: string;
      cfRay?: string | null;
      contentType?: string | null;
    },
  ) {
    super(message);
    this.name = "StarpagoRequestError";
    this.httpStatus = opts?.httpStatus;
    this.apiCode = opts?.apiCode;
    this.apiMsg = opts?.apiMsg;
    this.cfRay = opts?.cfRay;
    this.contentType = opts?.contentType;
  }

  toConnectivity(): StarpagoConnectivity {
    return {
      reachable: false,
      httpStatus: this.httpStatus,
      cfRay: this.cfRay,
      apiCode: this.apiCode,
      apiMsg: this.apiMsg,
    };
  }

  devHint(): string | undefined {
    if (this.httpStatus === 403) {
      return "Payment gateway blocked this server (HTTP 403). Test on your deployed site or ask the acquirer to allow your server IP.";
    }
    if (this.apiCode != null) {
      const detail = this.apiMsg?.trim();
      return detail
        ? `Gateway rejected the request (code ${this.apiCode}: ${detail}).`
        : `Gateway rejected the request (code ${this.apiCode}).`;
    }
    if (this.httpStatus != null && this.httpStatus >= 400) {
      return `Payment gateway HTTP ${this.httpStatus}.`;
    }
    return undefined;
  }
}

/** User-facing message for HQ / admin API routes. */
export function starpagoRequestErrorMessage(
  err: unknown,
  fallback = "Could not reach StarPago",
): string {
  if (err instanceof StarpagoRequestError) {
    const api = err.apiMsg?.trim();
    if (api) return api;
    return err.devHint() ?? err.message;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}

/** StarPago create-order expects `amount` as a JSON string, not a number. */
export function starpagoAmountString(amountPhp: number): string {
  const rounded = Math.round(amountPhp * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2);
}

function starpagoResponseMeta(res: Response) {
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    cfRay: res.headers.get("cf-ray"),
    server: res.headers.get("server"),
  };
}

async function parseStarpagoResponse<T>(
  path: string,
  res: Response,
): Promise<T> {
  const meta = starpagoResponseMeta(res);
  const text = await res.text();
  let json: StarpagoApiEnvelope<T>;
  try {
    json = JSON.parse(text) as StarpagoApiEnvelope<T>;
  } catch {
    const trimmed = text.trim();
    const relayRejectedPath =
      trimmed === "invalid path" ||
      (res.status === 400 &&
        /nginx\/\d/i.test(meta.server ?? "") &&
        trimmed.length < 64);
    const relayMessage = relayRejectedPath
      ? "StarPago relay blocked this API path. On the droplet, allow /api/v2/payout/order/create and /api/v2/payout/order/query (see scripts/starpago-relay/README.md)."
      : undefined;
    console.error("[starpago] non-json response", {
      path,
      ...meta,
      head: text.slice(0, 500),
    });
    throw new StarpagoRequestError(GCASH_START_ERROR, {
      httpStatus: res.status,
      cfRay: meta.cfRay,
      contentType: meta.contentType,
      apiMsg: relayMessage,
    });
  }

  if (json.code !== 0 || !json.data) {
    console.error("[starpago] api error", {
      path,
      status: res.status,
      code: json.code,
      msg: json.msg,
      error: json.error,
    });
    throw new StarpagoRequestError(GCASH_START_ERROR, {
      httpStatus: res.status,
      apiCode: json.code,
      apiMsg: json.msg ?? json.error,
      cfRay: meta.cfRay,
      contentType: meta.contentType,
    });
  }
  return json.data;
}

/** Super-admin diagnostic: can the server reach the payment API? */
export async function probeStarpagoConnectivity(): Promise<StarpagoConnectivity> {
  if (!starpagoConfigured()) {
    return { reachable: false, apiMsg: "not_configured" };
  }
  try {
    await getMerchantBalance();
    return { reachable: true };
  } catch (err) {
    if (err instanceof StarpagoRequestError) {
      return err.toConnectivity();
    }
    return { reachable: false, apiMsg: "unknown_error" };
  }
}

const STARPAGO_FETCH_HEADERS = {
  "Content-Type": "application/json;charset=utf-8",
  Accept: "application/json",
} as const;

export async function starpagoPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const secret = starpagoAppSecret();
  if (!secret) throw new Error("not_configured");

  const signed = { ...body, sign: starpagoSign(body, secret) };
  const res = starpagoUsesRelay()
    ? await fetch(relayForwardUrl(path), {
        method: "POST",
        headers: relayRequestHeaders({ ...STARPAGO_FETCH_HEADERS }),
        body: JSON.stringify(signed),
      })
    : await fetch(`${starpagoApiUrl()}${path}`, {
        method: "POST",
        headers: STARPAGO_FETCH_HEADERS,
        body: JSON.stringify(signed),
      });

  return parseStarpagoResponse<T>(path, res);
}

export async function starpagoGet<T>(
  path: string,
  query: Record<string, string>,
): Promise<T> {
  const secret = starpagoAppSecret();
  const appId = starpagoAppId();
  if (!secret || !appId) throw new Error("not_configured");

  const params: Record<string, unknown> = { appId, ...query };
  params.sign = starpagoSign(params, secret);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, String(v));
  }

  const queryString = qs.toString();
  const res = starpagoUsesRelay()
    ? await fetch(relayForwardUrl(path, queryString), {
        method: "GET",
        headers: relayRequestHeaders({ Accept: "application/json" }),
        cache: "no-store",
      })
    : await fetch(`${starpagoApiUrl()}${path}?${queryString}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

  return parseStarpagoResponse<T>(path, res);
}

export async function createPayinOrder(input: {
  payMethod: string;
  merOrderNo: string;
  amountPhp: number;
  email: string;
  mobile: string;
  accountName: string;
  attach?: string;
  returnUrl: string;
}): Promise<{
  orderNo: string;
  paymentLink: string;
  qrContent: string;
  orderStatus: number;
}> {
  const appId = starpagoAppId();
  if (!appId) throw new Error("not_configured");

  const amount = starpagoAmountString(input.amountPhp);
  const body: Record<string, unknown> = {
    appId,
    merOrderNo: input.merOrderNo,
    notifyUrl: starpagoNotifyUrl(),
    currency: "PHP",
    amount,
    payMethod: input.payMethod,
    extra: {
      email: input.email.trim(),
      mobile: input.mobile,
      accountName: input.accountName.trim(),
    },
    returnUrl: input.returnUrl,
  };
  const attach = input.attach?.trim();
  if (attach) body.attach = attach;

  const data = await starpagoPost<StarpagoCreateOrderData>(
    "/api/v2/payment/order/create",
    body,
  );

  const parsed = parseStarpagoPayinParams(data, input.payMethod);
  const { paymentLink, qrContent, usedPaymentLinkAsQr } = parsed;
  if (usedPaymentLinkAsQr) {
    console.warn("[starpago] QR pay-in used paymentLink as QR payload", {
      payMethod: input.payMethod,
      orderNo: data.orderNo,
    });
  }
  if (!data.orderNo || (!paymentLink && !qrContent)) {
    throw new StarpagoRequestError(STARPAGO_START_ERROR, {
      apiMsg: data.message?.trim() || undefined,
    });
  }

  return {
    orderNo: data.orderNo,
    paymentLink,
    qrContent,
    orderStatus: Number(data.orderStatus ?? 0),
  };
}

export async function createGcashOrder(input: {
  merOrderNo: string;
  amountPhp: number;
  email: string;
  mobile: string;
  accountName: string;
  attach?: string;
  returnUrl: string;
}): Promise<{
  orderNo: string;
  paymentLink: string;
  orderStatus: number;
}> {
  return createPayinOrder({
    ...input,
    payMethod: STARPAGO_PAY_METHOD_GCASH,
  });
}

export async function queryPayinOrder(
  merOrderNo: string,
): Promise<StarpagoQueryOrderData> {
  return starpagoGet<StarpagoQueryOrderData>(
    "/api/v2/payment/order/query",
    { merOrderNo },
  );
}

export async function getMerchantBalance(): Promise<StarpagoBalanceData> {
  return starpagoGet<StarpagoBalanceData>("/api/v2/merchant/balance", {});
}

export function starpagoSignDocExample(): boolean {
  const secret = "daa153d25c25c3736b474a91aeaa7fa7";
  const params: Record<string, unknown> = {
    appId: "af37752d8bfc9c23ce9a39e6cf44d135",
    merOrderNo: "4085_12200315",
    notifyUrl:
      "https://19fb-15-164-4-252.ngrok-free.app/Payin/Callback/StarPagoPayTHB/4085",
    currency: "THB",
    amount: "100",
    payMethod: "PROMPTPAY",
    extra: {
      accountName: "NGUYEN TIEN HUY",
      accountNo: "123456123456",
      bankCode: "TMB",
      email: "StarPago@gmail.com",
      mobile: "0123445677",
    },
    returnUrl: "/",
    attach: "StarPago",
  };
  const sign = starpagoSign(params, secret);
  return (
    sign ===
    "5b62786f67b0fed16f41ea53ba5c177f6916248915bf7d3dd6fcfd2c6527e967"
  );
}

export function clientIpFromRequest(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || null;
}

export function isStarpagoCallbackIpAllowed(ip: string | null): boolean {
  if (!ip) return false;
  const allow = starpagoCallbackIps();
  if (allow.length === 0) return true;
  return allow.includes(ip);
}
