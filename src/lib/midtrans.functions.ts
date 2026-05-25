import { createServerFn } from "@tanstack/react-start";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SANDBOX_SNAP = "https://app.sandbox.midtrans.com/snap/v1/transactions";
const PROD_SNAP = "https://app.midtrans.com/snap/v1/transactions";
const SANDBOX_STATUS = "https://api.sandbox.midtrans.com/v2";
const PROD_STATUS = "https://api.midtrans.com/v2";

const ALL_METHODS = ["qris","gopay","shopeepay","other_qris","bca_va","bni_va","bri_va","permata_va","other_va","dana","credit_card"];
function methodsFor(method?: string | null): string[] {
  switch (method) {
    case "qris": return ["qris", "other_qris"];
    case "gopay": return ["gopay"];
    case "shopeepay": return ["shopeepay"];
    case "dana": return ["dana"];
    case "va": return ["bca_va","bni_va","bri_va","permata_va","other_va"];
    case "credit_card": return ["credit_card"];
    default: return ALL_METHODS;
  }
}

function midtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.MIDTRANS_CLIENT_KEY;
  const isProduction = String(process.env.MIDTRANS_IS_PRODUCTION ?? "false").toLowerCase() === "true";
  const missing: string[] = [];
  if (!serverKey) missing.push("MIDTRANS_SERVER_KEY");
  if (!clientKey) missing.push("MIDTRANS_CLIENT_KEY");
  if (missing.length) {
    throw new Error(
      `Pembayaran belum dikonfigurasi. Admin perlu mengisi secret berikut di Lovable Cloud: ${missing.join(", ")}.`
    );
  }
  return {
    serverKey: serverKey!, clientKey: clientKey!, isProduction,
    snapApi: isProduction ? PROD_SNAP : SANDBOX_SNAP,
    statusApi: isProduction ? PROD_STATUS : SANDBOX_STATUS,
    auth: "Basic " + Buffer.from(serverKey! + ":").toString("base64"),
  };
}

export const createTopupTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      package_id: z.string().uuid(),
      method: z.enum(["qris","gopay","shopeepay","dana","va","credit_card"]).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cfg = midtransConfig();

    // Load package
    const { data: pkg, error: pErr } = await supabase
      .from("coin_packages")
      .select("*")
      .eq("id", data.package_id)
      .eq("is_active", true)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!pkg) throw new Error("Paket tidak ditemukan");

    // Profile (for customer details)
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", userId)
      .maybeSingle();

    const orderId = `BL-${Date.now()}-${userId.slice(0, 8)}`;

    // Insert pending transaction (admin via service role)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: tErr } = await supabaseAdmin.rpc("create_pending_transaction_v2", {
      _user_id: userId,
      _order_id: orderId,
      _amount_idr: pkg.price_idr,
      _coin_amount: pkg.coin_amount,
      _bonus_coin: pkg.bonus_coin,
      _tx_type: "topup",
      _ref_id: null as unknown as string,
      _meta: null as unknown as Json,
    });
    if (tErr) throw new Error("Gagal membuat transaksi: " + tErr.message);

    const body = {
      transaction_details: { order_id: orderId, gross_amount: pkg.price_idr },
      item_details: [
        {
          id: pkg.id,
          name: `${pkg.name} - ${pkg.coin_amount}${pkg.bonus_coin ? `+${pkg.bonus_coin}` : ""} koin`,
          price: pkg.price_idr,
          quantity: 1,
          category: "coin",
        },
      ],
      customer_details: {
        first_name: profile?.display_name ?? profile?.username ?? "Reader",
      },
      enabled_payments: ["qris", "gopay", "shopeepay", "other_qris", "bca_va", "bni_va", "bri_va", "permata_va", "other_va", "dana"],
      credit_card: { secure: true },
    };
    body.enabled_payments = methodsFor(data.method);

    const res = await fetch(cfg.snapApi, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: cfg.auth,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.token) {
      console.error("Midtrans error", json);
      throw new Error(json.error_messages?.[0] ?? "Gagal membuat transaksi Midtrans");
    }

    // Save snap token
    await supabaseAdmin
      .from("transactions")
      .update({ snap_token: json.token })
      .eq("order_id", orderId);

    return {
      order_id: orderId,
      snap_token: json.token,
      client_key: cfg.clientKey,
      is_production: cfg.isProduction,
      redirect_url: json.redirect_url,
    };
  });

export const getMyTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { transactions: data ?? [] };
  });

export const createVipTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      plan: z.enum(["monthly", "yearly"]),
      method: z.enum(["qris","gopay","shopeepay","dana","va","credit_card"]).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cfg = midtransConfig();

    const PRICE = data.plan === "monthly" ? 49000 : 449000;
    const MONTHS = data.plan === "monthly" ? 1 : 12;

    const { data: profile } = await supabase
      .from("profiles").select("username, display_name, vip_until").eq("id", userId).maybeSingle();

    if (profile?.vip_until && new Date(profile.vip_until) > new Date()) {
      throw new Error(`VIP kamu masih aktif sampai ${new Date(profile.vip_until).toLocaleDateString("id-ID")}. Tidak bisa beli ulang sebelum expired.`);
    }

    const orderId = `VIP-${Date.now()}-${userId.slice(0, 8)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: tErr } = await supabaseAdmin.rpc("create_pending_transaction_v2", {
      _user_id: userId,
      _order_id: orderId,
      _amount_idr: PRICE,
      _coin_amount: 0,
      _bonus_coin: 0,
      _tx_type: "vip_sub",
      _ref_id: null as unknown as string,
      _meta: ({ months: MONTHS, plan: data.plan } as unknown as Json),
    });
    if (tErr) throw new Error("Gagal membuat transaksi VIP: " + tErr.message);

    const body = {
      transaction_details: { order_id: orderId, gross_amount: PRICE },
      item_details: [{ id: `vip-${data.plan}`, name: `BookLink VIP ${MONTHS} bulan`, price: PRICE, quantity: 1, category: "vip" }],
      customer_details: { first_name: profile?.display_name ?? profile?.username ?? "Reader" },
      enabled_payments: ["qris","gopay","shopeepay","other_qris","bca_va","bni_va","bri_va","permata_va","other_va","dana"],
      credit_card: { secure: true },
    };
    body.enabled_payments = methodsFor(data.method);
    const res = await fetch(cfg.snapApi, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: cfg.auth },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.token) {
      console.error("Midtrans VIP error", json);
      throw new Error(json.error_messages?.[0] ?? "Gagal membuat transaksi VIP");
    }
    await supabaseAdmin.from("transactions").update({ snap_token: json.token }).eq("order_id", orderId);
    return { order_id: orderId, snap_token: json.token, client_key: cfg.clientKey, is_production: cfg.isProduction, redirect_url: json.redirect_url };
  });

/** Helper: create a Snap transaction for arbitrary author payment (story VIP / paid chapter). */
async function createAuthorPayment(opts: {
  userId: string;
  price: number;
  txType: "vip_story" | "paid_chapter";
  refId: string;
  orderPrefix: string;
  itemName: string;
  method?: string;
  displayName: string;
}) {
  const cfg = midtransConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const orderId = `${opts.orderPrefix}-${Date.now()}-${opts.userId.slice(0, 8)}`;

  const { error: tErr } = await supabaseAdmin.rpc("create_pending_transaction_v2", {
    _user_id: opts.userId,
    _order_id: orderId,
    _amount_idr: opts.price,
    _coin_amount: 0,
    _bonus_coin: 0,
    _tx_type: opts.txType,
    _ref_id: opts.refId,
    _meta: { kind: opts.txType } as unknown as Json,
  });
  if (tErr) throw new Error("Gagal membuat transaksi: " + tErr.message);

  const body = {
    transaction_details: { order_id: orderId, gross_amount: opts.price },
    item_details: [{ id: opts.txType, name: opts.itemName, price: opts.price, quantity: 1, category: "author" }],
    customer_details: { first_name: opts.displayName },
    enabled_payments: methodsFor(opts.method),
    credit_card: { secure: true },
  };
  const res = await fetch(cfg.snapApi, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: cfg.auth },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.token) {
    console.error("Midtrans author payment error", json);
    throw new Error(json.error_messages?.[0] ?? "Gagal membuat transaksi");
  }
  await supabaseAdmin.from("transactions").update({ snap_token: json.token }).eq("order_id", orderId);
  return { order_id: orderId, snap_token: json.token, client_key: cfg.clientKey, is_production: cfg.isProduction };
}

export const createStoryVipPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      story_id: z.string().uuid(),
      method: z.enum(["qris","gopay","shopeepay","dana","va","credit_card"]).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: story, error } = await supabase
      .from("stories").select("id, author_id, title, vip_payment_status").eq("id", data.story_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!story) throw new Error("Cerita tidak ditemukan");
    if (story.author_id !== userId) throw new Error("Bukan cerita kamu");
    if (story.vip_payment_status === "success") throw new Error("Cerita ini sudah dibayar VIP");
    const { data: profile } = await supabase.from("profiles").select("display_name, username").eq("id", userId).maybeSingle();
    return createAuthorPayment({
      userId, price: 15000, txType: "vip_story", refId: data.story_id,
      orderPrefix: "SVIP", itemName: `Aktivasi VIP cerita: ${story.title}`,
      method: data.method, displayName: profile?.display_name ?? profile?.username ?? "Author",
    });
  });

export const createChapterPaidPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      chapter_id: z.string().uuid(),
      method: z.enum(["qris","gopay","shopeepay","dana","va","credit_card"]).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: chapter, error } = await supabase
      .from("chapters").select("id, title, story_id, chapter_payment_status").eq("id", data.chapter_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!chapter) throw new Error("Chapter tidak ditemukan");
    const { data: story } = await supabase.from("stories").select("author_id").eq("id", chapter.story_id).maybeSingle();
    if (!story || story.author_id !== userId) throw new Error("Bukan chapter kamu");
    if (chapter.chapter_payment_status === "success") throw new Error("Chapter ini sudah dibayar");
    const { data: profile } = await supabase.from("profiles").select("display_name, username").eq("id", userId).maybeSingle();
    return createAuthorPayment({
      userId, price: 2000, txType: "paid_chapter", refId: data.chapter_id,
      orderPrefix: "CHP", itemName: `Aktivasi Premium • 10 Coin: ${chapter.title}`,
      method: data.method, displayName: profile?.display_name ?? profile?.username ?? "Author",
    });
  });

/** Get current Midtrans mode + client key (for re-opening Snap on pending tx). */
export const getMidtransConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = midtransConfig();
    return { client_key: cfg.clientKey, is_production: cfg.isProduction };
  });

/** Force-sync a transaction status from Midtrans (in case webhook is late). */
export const checkTransactionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ order_id: z.string().min(3).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    const cfg = midtransConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ownership check via authenticated client (RLS)
    const { data: tx, error: txErr } = await context.supabase
      .from("transactions").select("*").eq("order_id", data.order_id).maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("Transaksi tidak ditemukan");

    const res = await fetch(`${cfg.statusApi}/${encodeURIComponent(data.order_id)}/status`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: cfg.auth },
    });
    const payload = await res.json();
    if (!res.ok && payload?.status_code !== "404") {
      console.error("Midtrans status err", payload);
      throw new Error(payload?.status_message ?? "Gagal cek status");
    }

    const transactionStatus = String(payload.transaction_status ?? "");
    const fraudStatus = String(payload.fraud_status ?? "accept");
    const paymentType = String(payload.payment_type ?? tx.payment_type ?? "");

    let mapped: "success" | "failed" | "expired" | "cancel" | "pending" = "pending";
    if (transactionStatus === "capture" || transactionStatus === "settlement") mapped = fraudStatus === "accept" ? "success" : "failed";
    else if (transactionStatus === "deny" || transactionStatus === "failure") mapped = "failed";
    else if (transactionStatus === "expire") mapped = "expired";
    else if (transactionStatus === "cancel") mapped = "cancel";

    if (mapped !== "pending" && tx.status !== "success") {
      console.log("[midtrans-check-status] fulfilling transaction", {
        order_id: data.order_id,
        previous_status: tx.status,
        mapped,
        transactionStatus,
        fraudStatus,
      });
      const { data: fulfillResult, error } = await supabaseAdmin.rpc("fulfill_transaction", {
        _order_id: data.order_id,
        _status: mapped,
        _payment_type: paymentType,
        _midtrans: payload,
      });
      if (error) {
        console.error("[midtrans-check-status] fulfill_transaction error", error);
        throw new Error("Pembayaran terdeteksi, tapi update database gagal: " + error.message);
      }
      console.log("[midtrans-check-status] fulfilled", { order_id: data.order_id, result: fulfillResult });
    }

    return { status: mapped, raw_status: transactionStatus, payment_type: paymentType };
  });

/** Change payment method on a pending transaction.
 * Cancels the old order at Midtrans + DB, creates a new pending tx with the
 * same tx_type / amount / ref / meta but a fresh order_id and snap token. */
export const changeTransactionMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      order_id: z.string().min(3).max(100),
      method: z.enum(["qris","gopay","shopeepay","dana","va","credit_card"]),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const cfg = midtransConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // Ownership + status check via RLS-respecting client
    const { data: tx, error: txErr } = await context.supabase
      .from("transactions").select("*").eq("order_id", data.order_id).maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("Transaksi tidak ditemukan");
    if (tx.status !== "pending") throw new Error("Hanya transaksi pending yang bisa ganti metode.");

    // Try to cancel old at Midtrans (ignore failure — may already be expired)
    try {
      await fetch(`${cfg.statusApi}/${encodeURIComponent(tx.order_id)}/cancel`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: cfg.auth },
      });
    } catch (_e) { /* ignore */ }

    // Mark old as cancelled in DB
    await supabaseAdmin.from("transactions")
      .update({ status: "cancel", updated_at: new Date().toISOString() })
      .eq("order_id", tx.order_id);

    // Get profile for customer_details
    const { data: profile } = await context.supabase
      .from("profiles").select("display_name, username").eq("id", userId).maybeSingle();
    const displayName = profile?.display_name ?? profile?.username ?? "Reader";

    // Build new order_id preserving prefix
    const prefix = tx.order_id.split("-")[0] || "BL";
    const newOrderId = `${prefix}-${Date.now()}-${userId.slice(0, 8)}`;

    const { error: insErr } = await supabaseAdmin.rpc("create_pending_transaction_v2", {
      _user_id: userId,
      _order_id: newOrderId,
      _amount_idr: tx.amount_idr,
      _coin_amount: tx.coin_amount,
      _bonus_coin: tx.bonus_coin,
      _tx_type: tx.tx_type ?? "topup",
      _ref_id: tx.ref_id as unknown as string,
      _meta: tx.meta as unknown as Json,
    });
    if (insErr) throw new Error("Gagal membuat transaksi baru: " + insErr.message);

    const itemName =
      tx.tx_type === "vip_sub" ? `BookLink VIP` :
      tx.tx_type === "vip_story" ? `Aktivasi VIP cerita` :
      tx.tx_type === "paid_chapter" ? `Aktivasi Chapter Premium` :
      `Top-up ${tx.coin_amount}${tx.bonus_coin ? `+${tx.bonus_coin}` : ""} koin`;

    const body = {
      transaction_details: { order_id: newOrderId, gross_amount: tx.amount_idr },
      item_details: [{ id: tx.tx_type ?? "topup", name: itemName, price: tx.amount_idr, quantity: 1, category: tx.tx_type ?? "topup" }],
      customer_details: { first_name: displayName },
      enabled_payments: methodsFor(data.method),
      credit_card: { secure: true },
    };
    const res = await fetch(cfg.snapApi, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: cfg.auth },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.token) {
      console.error("Midtrans change-method error", json);
      throw new Error(json.error_messages?.[0] ?? "Gagal regenerate Snap");
    }
    await supabaseAdmin.from("transactions").update({ snap_token: json.token }).eq("order_id", newOrderId);

    return {
      order_id: newOrderId,
      snap_token: json.token,
      client_key: cfg.clientKey,
      is_production: cfg.isProduction,
    };
  });
