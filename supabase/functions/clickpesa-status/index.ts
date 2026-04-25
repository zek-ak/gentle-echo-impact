// ClickPesa - Query payment status by order reference
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const CLICKPESA_BASE = "https://api.clickpesa.com";
const CLIENT_ID = Deno.env.get("CLICKPESA_CLIENT_ID")!;
const API_KEY = Deno.env.get("CLICKPESA_API_KEY")!;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function generateToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch(`${CLICKPESA_BASE}/third-parties/generate-token`, {
    method: "POST",
    headers: { "client-id": CLIENT_ID, "api-key": API_KEY },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token failed: ${res.status} ${text}`);
  const data = JSON.parse(text);
  const raw: string = data.token ?? data.Authorization ?? "";
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  cachedToken = { token, expiresAt: Date.now() + 55 * 60_000 };
  return token;
}

function mapStatus(s: string): string {
  const upper = (s || "").toUpperCase();
  if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "SETTLED"].includes(upper)) return "success";
  if (["FAILED", "FAILURE", "CANCELLED", "CANCELED"].includes(upper)) return "failed";
  if (["REVERSED"].includes(upper)) return "reversed";
  if (["REFUNDED"].includes(upper)) return "refunded";
  return "processing";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let orderReference: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      orderReference = body?.orderReference ?? null;
    } else {
      const url = new URL(req.url);
      orderReference = url.searchParams.get("orderReference");
    }

    if (!orderReference) {
      return new Response(JSON.stringify({ success: false, error: "orderReference required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = await generateToken();
    const cpRes = await fetch(
      `${CLICKPESA_BASE}/third-parties/payments/${encodeURIComponent(orderReference)}`,
      { headers: { "Authorization": `Bearer ${token}` } },
    );
    const cpText = await cpRes.text();
    let cpData: any;
    try { cpData = JSON.parse(cpText); } catch { cpData = { raw: cpText }; }

    // Endpoint returns array of payments for that orderReference
    const latest = Array.isArray(cpData) ? cpData[cpData.length - 1] : cpData;
    const rawStatus = latest?.status ?? latest?.paymentStatus ?? "PROCESSING";
    const normalized = mapStatus(rawStatus);

    // Update DB if we know the contribution
    await supabase
      .from("contributions")
      .update({ status: normalized })
      .eq("clickpesa_order_reference", orderReference);

    return new Response(
      JSON.stringify({
        success: true,
        orderReference,
        status: normalized,
        rawStatus,
        provider: latest,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[clickpesa-status] error", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
