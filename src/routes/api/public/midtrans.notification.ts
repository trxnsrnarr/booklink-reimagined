import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Midtrans HTTP notification handler.
 * Endpoint: POST /api/public/midtrans/notification  (alias: /api/public/midtrans/webhook)
 *
 * Pasang URL ini di Midtrans Dashboard:
 *   Settings → Configuration → Payment Notification URL
 *   https://<your-domain>/api/public/midtrans/notification
 */
export async function handleMidtransNotification(request: Request) {
  const startedAt = Date.now();
  const reqId = Math.random().toString(36).slice(2, 8);
  const log = (msg: string, extra?: Record<string, unknown>) =>
    console.log(`[midtrans-webhook ${reqId}] ${msg}`, extra ?? "");

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    console.error(`[midtrans-webhook ${reqId}] MIDTRANS_SERVER_KEY not configured`);
    return json({ ok: false, error: "Server not configured" }, 500);
  }

  // 1. Read raw body
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error(`[midtrans-webhook ${reqId}] failed to read body`, e);
    return json({ ok: false, error: "Cannot read body" }, 400);
  }
  log("incoming", {
    method: request.method,
    url: request.url,
    contentType: request.headers.get("content-type"),
    bodyLength: rawBody.length,
    bodyPreview: rawBody.slice(0, 500),
  });

  // 2. Parse JSON
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error(`[midtrans-webhook ${reqId}] invalid JSON body`);
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const orderId = String(payload.order_id ?? "");
  const statusCode = String(payload.status_code ?? "");
  const grossAmount = String(payload.gross_amount ?? "");
  const signatureKey = String(payload.signature_key ?? "");
  const transactionStatus = String(payload.transaction_status ?? "");
  const fraudStatus = String(payload.fraud_status ?? "accept");
  const paymentType = String(payload.payment_type ?? "");

  log("parsed", { orderId, statusCode, grossAmount, transactionStatus, fraudStatus, paymentType });

  if (!orderId || !signatureKey) {
    console.error(`[midtrans-webhook ${reqId}] missing required fields`, {
      hasOrder: !!orderId, hasSig: !!signatureKey,
    });
    return json({ ok: false, error: "Missing required fields" }, 400);
  }

  // 3. Verify signature
  const expected = createHash("sha512")
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest("hex");
  if (expected !== signatureKey) {
    console.warn(`[midtrans-webhook ${reqId}] signature mismatch`, {
      orderId,
      expectedPreview: expected.slice(0, 16) + "...",
      receivedPreview: signatureKey.slice(0, 16) + "...",
    });
    return json({ ok: false, error: "Invalid signature" }, 401);
  }
  log("signature ok");

  // 4. Map status
  let mapped: "success" | "failed" | "expired" | "cancel" | "pending" = "pending";
  if (transactionStatus === "capture" || transactionStatus === "settlement") {
    mapped = fraudStatus === "accept" ? "success" : "failed";
  } else if (transactionStatus === "deny" || transactionStatus === "failure") {
    mapped = "failed";
  } else if (transactionStatus === "expire") {
    mapped = "expired";
  } else if (transactionStatus === "cancel") {
    mapped = "cancel";
  }
  log("mapped status", { orderId, mapped });

  if (mapped === "pending") {
    return json({ ok: true, status: "pending", note: "Acknowledged, awaiting payment" }, 200);
  }

  // 5. Fulfill (idempotent — fulfill_transaction returns {status:'already'} on repeat)
  try {
    const { data, error } = await supabaseAdmin.rpc("fulfill_transaction", {
      _order_id: orderId,
      _status: mapped,
      _payment_type: paymentType,
      _midtrans: JSON.parse(JSON.stringify(payload)),
    });
    if (error) {
      console.error(`[midtrans-webhook ${reqId}] fulfill_transaction error`, {
        orderId, message: error.message, details: error.details, code: error.code,
      });
      return json({ ok: false, error: "Database update failed", details: error.message }, 500);
    }
    log("fulfilled", { orderId, result: data, durationMs: Date.now() - startedAt });
    return json({ ok: true, status: mapped, result: data, request_id: reqId }, 200);
  } catch (err) {
    const e = err as Error;
    console.error(`[midtrans-webhook ${reqId}] unexpected error`, { stack: e.stack, message: e.message });
    return json({ ok: false, error: "Internal error", message: e.message }, 500);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/midtrans/notification")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMidtransNotification(request),
      // GET returns a friendly status so author can verify the endpoint is reachable from a browser.
      GET: async () => json({
        ok: true,
        endpoint: "/api/public/midtrans/notification",
        method: "POST",
        note: "Set this URL in Midtrans Dashboard → Settings → Configuration → Payment Notification URL",
      }, 200),
    },
  },
});
