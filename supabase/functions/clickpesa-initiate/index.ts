// ClickPesa - Initiate USSD Push (direct mobile money charge)
// User receives a USSD prompt on their phone and confirms with their PIN.
// No redirect / no hosted checkout — fully in-app experience.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLICKPESA_BASE = "https://api.clickpesa.com";
const CLIENT_ID = Deno.env.get("CLICKPESA_CLIENT_ID")!;
const API_KEY = Deno.env.get("CLICKPESA_API_KEY")!;
// Checksum imezimwa — ClickPesa account hii haijawekewa checksum validation.
// Kama itahitajika baadaye, weka CLICKPESA_CHECKSUM_KEY na ubadilishe USE_CHECKSUM = true.
const CHECKSUM_KEY = Deno.env.get("CLICKPESA_CHECKSUM_KEY") ?? "";
const USE_CHECKSUM = false;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function generateToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch(`${CLICKPESA_BASE}/third-parties/generate-token`, {
    method: "POST",
    headers: { "client-id": CLIENT_ID, "api-key": API_KEY },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[clickpesa] token error", res.status, text);
    throw new Error(`Token generation failed: ${res.status} ${text}`);
  }
  const data = JSON.parse(text);
  const raw: string = data.token ?? data.Authorization ?? "";
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Empty token from ClickPesa");
  cachedToken = { token, expiresAt: Date.now() + 55 * 60_000 };
  return token;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildChecksum(payload: Record<string, unknown>): Promise<string> {
  const keys = Object.keys(payload)
    .filter((k) => k !== "checksum" && k !== "checksumMethod")
    .sort();
  const message = keys.map((k) => String(payload[k] ?? "")).join("");
  return await hmacSha256Hex(CHECKSUM_KEY, message);
}

// Normalize a Tanzanian phone to 255XXXXXXXXX format expected by ClickPesa.
function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("255")) return digits;
  if (digits.startsWith("0")) return "255" + digits.slice(1);
  if (digits.length === 9) return "255" + digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      amount,
      phone,
      userId,
      projectId,
      reference: noteRef,
    } = body ?? {};

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 500 || numAmount > 3_000_000) {
      return new Response(
        JSON.stringify({ success: false, error: "Amount must be between 500 and 3,000,000 TZS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanPhone = normalizePhone(phone || "");
    if (!cleanPhone || cleanPhone.length < 12) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid phone number required for USSD push" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Unique reference (max 20 chars per ClickPesa)
    const orderReference = `CK${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
      .toUpperCase()
      .slice(0, 20);

    const { data: contribution, error: insertError } = await supabase
      .from("contributions")
      .insert({
        user_id: userId ?? null,
        project_id: projectId ?? null,
        amount: numAmount,
        method: "mobile_money",
        reference: noteRef ?? null,
        status: "pending",
        clickpesa_order_reference: orderReference,
        payment_provider: "clickpesa",
        currency: "TZS",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[clickpesa] insert error", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to record contribution" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = await generateToken();

    // Step 1: Preview to confirm the order is accepted
    const previewPayload: Record<string, unknown> = {
      amount: String(numAmount),
      currency: "TZS",
      orderReference,
      phoneNumber: cleanPhone,
    };
    if (USE_CHECKSUM && CHECKSUM_KEY) previewPayload.checksum = await buildChecksum(previewPayload);

    console.log("[clickpesa] preview USSD", { orderReference, amount: numAmount, phone: cleanPhone });

    const previewRes = await fetch(
      `${CLICKPESA_BASE}/third-parties/payments/preview-ussd-push-request`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(previewPayload),
      },
    );
    const previewText = await previewRes.text();
    let previewData: any;
    try { previewData = JSON.parse(previewText); } catch { previewData = { raw: previewText }; }
    console.log("[clickpesa] preview response", previewRes.status, previewData);

    // Some accounts return an array of available payment methods, others a single object.
    const methods = Array.isArray(previewData) ? previewData : (previewData?.activeMethods ?? []);
    const firstActive = Array.isArray(methods) && methods.length > 0 ? methods[0] : null;

    if (!previewRes.ok || (Array.isArray(methods) && methods.length === 0)) {
      await supabase.from("contributions").update({ status: "failed" }).eq("id", contribution.id);
      const msg = previewData?.message || "No mobile money provider available for this number";
      return new Response(
        JSON.stringify({ success: false, error: msg, details: previewData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 2: Initiate the USSD push
    const initiatePayload: Record<string, unknown> = {
      amount: String(numAmount),
      currency: "TZS",
      orderReference,
      phoneNumber: cleanPhone,
    };
    if (USE_CHECKSUM && CHECKSUM_KEY) initiatePayload.checksum = await buildChecksum(initiatePayload);

    const initiateRes = await fetch(
      `${CLICKPESA_BASE}/third-parties/payments/initiate-ussd-push-request`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(initiatePayload),
      },
    );
    const initText = await initiateRes.text();
    let initData: any;
    try { initData = JSON.parse(initText); } catch { initData = { raw: initText }; }
    console.log("[clickpesa] initiate response", initiateRes.status, initData);

    if (!initiateRes.ok) {
      await supabase.from("contributions").update({ status: "failed" }).eq("id", contribution.id);
      const msg = initData?.message || "Could not send USSD push. Please try again.";
      return new Response(
        JSON.stringify({ success: false, error: msg, details: initData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderReference,
        contributionId: contribution.id,
        provider: firstActive?.name ?? null,
        message: "USSD push sent. Confirm on your phone.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[clickpesa] fatal", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
