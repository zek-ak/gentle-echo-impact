// ClickPesa - Generate hosted checkout URL (for bank/card flow opened in popup)
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { amount, userId, projectId, reference: noteRef, customerName, customerEmail } = body ?? {};

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 500 || numAmount > 3_000_000) {
      return new Response(
        JSON.stringify({ success: false, error: "Amount must be between 500 and 3,000,000 TZS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const orderReference = `CK${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
      .toUpperCase()
      .slice(0, 20);

    const { data: contribution, error: insertError } = await supabase
      .from("contributions")
      .insert({
        user_id: userId ?? null,
        project_id: projectId ?? null,
        amount: numAmount,
        method: "bank",
        payment_method_used: "bank",
        reference: noteRef ?? null,
        status: "pending",
        clickpesa_order_reference: orderReference,
        payment_provider: "clickpesa",
        currency: "TZS",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[clickpesa-checkout] insert error", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to record contribution" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = await generateToken();

    const checkoutPayload: Record<string, unknown> = {
      amount: String(numAmount),
      currency: "TZS",
      orderReference,
    };
    if (customerName) checkoutPayload.customerName = customerName;
    if (customerEmail) checkoutPayload.customerEmail = customerEmail;

    console.log("[clickpesa-checkout] generating checkout", { orderReference, amount: numAmount });

    const cpRes = await fetch(
      `${CLICKPESA_BASE}/third-parties/checkout-link/generate-checkout-url`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
      },
    );
    const cpText = await cpRes.text();
    let cpData: any;
    try { cpData = JSON.parse(cpText); } catch { cpData = { raw: cpText }; }
    console.log("[clickpesa-checkout] response", cpRes.status, cpData);

    if (!cpRes.ok || !cpData?.checkoutLink) {
      await supabase.from("contributions").update({ status: "failed" }).eq("id", contribution.id);
      const msg = cpData?.message || "Could not generate payment link";
      return new Response(
        JSON.stringify({ success: false, error: msg, details: cpData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("contributions")
      .update({ payment_link: cpData.checkoutLink })
      .eq("id", contribution.id);

    return new Response(
      JSON.stringify({
        success: true,
        orderReference,
        contributionId: contribution.id,
        paymentLink: cpData.checkoutLink,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[clickpesa-checkout] fatal", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
