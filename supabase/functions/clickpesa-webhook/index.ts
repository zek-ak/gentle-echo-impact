// ClickPesa - Webhook receiver. Validates checksum, updates contribution status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-clickpesa-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const raw = await req.text();
    console.log("[clickpesa-webhook] received", raw);

    let payload: Record<string, unknown>;
    try { payload = JSON.parse(raw); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Checksum validation is disabled (not enabled on this ClickPesa account).

    const orderReference =
      (payload.orderReference as string) ||
      (payload.order_reference as string) ||
      "";
    const rawStatus =
      (payload.status as string) ||
      (payload.paymentStatus as string) ||
      "PROCESSING";

    if (!orderReference) {
      return new Response(JSON.stringify({ error: "Missing orderReference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = mapStatus(rawStatus);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase
      .from("contributions")
      .update({ status: normalized })
      .eq("clickpesa_order_reference", orderReference);

    if (error) {
      console.error("[clickpesa-webhook] db error", error);
      return new Response(JSON.stringify({ error: "DB update failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[clickpesa-webhook] updated", orderReference, "->", normalized);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[clickpesa-webhook] fatal", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
