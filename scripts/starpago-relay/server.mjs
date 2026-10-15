/**
 * StarPago HTTPS relay (fixed egress IP for merchant allowlist).
 * Deploy on the droplet behind nginx → https://starpago-relay.regmytourna.com
 *
 * Env: RELAY_SECRET, STARPAGO_API_HOST (default ph.api.starpago.com), PORT (default 8787)
 */
import http from "node:http";
import { URL } from "node:url";

const RELAY_SECRET = process.env.RELAY_SECRET?.trim();
const STARPAGO_HOST =
  process.env.STARPAGO_API_HOST?.trim() || "ph.api.starpago.com";
const PORT = Number(process.env.PORT ?? 8787);

/** Exact paths forwarded to StarPago (method-agnostic). */
const ALLOWED_PATHS = new Set([
  "/api/v2/payment/order/create",
  "/api/v2/payment/order/query",
  "/api/v2/merchant/balance",
  "/api/v2/payout/order/create",
  "/api/v2/payout/order/query",
]);

function unauthorized(res) {
  res.writeHead(401, { "Content-Type": "text/plain" });
  res.end("unauthorized");
}

function badPath(res) {
  res.writeHead(400, { "Content-Type": "text/plain" });
  res.end("invalid path");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function forwardToStarpago(method, apiPath, queryString, body) {
  const url = new URL(`https://${STARPAGO_HOST}${apiPath}`);
  if (queryString) {
    url.search = queryString;
  }
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json;charset=utf-8",
  };
  if (body.length > 0) {
    headers["Content-Length"] = String(body.length);
  }
  return fetch(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    if (url.pathname !== "/forward") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }

    const auth = req.headers.authorization ?? "";
    if (!RELAY_SECRET || auth !== `Bearer ${RELAY_SECRET}`) {
      unauthorized(res);
      return;
    }

    const apiPath = url.searchParams.get("path") ?? "";
    const normalized = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
    if (!ALLOWED_PATHS.has(normalized)) {
      badPath(res);
      return;
    }

    const queryString = url.searchParams.get("query") ?? "";
    const body = await readBody(req);
    const upstream = await forwardToStarpago(
      req.method ?? "GET",
      normalized,
      queryString,
      body,
    );

    const text = await upstream.text();
    const outHeaders = { "Content-Type": upstream.headers.get("content-type") ?? "application/json" };
    res.writeHead(upstream.status, outHeaders);
    res.end(text);
  } catch (err) {
    console.error("[relay]", err);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("upstream error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`starpago relay listening on 127.0.0.1:${PORT}`);
});
