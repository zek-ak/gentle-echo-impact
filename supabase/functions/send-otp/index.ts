import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "255" + cleaned.slice(1);
  }
  if (!cleaned.startsWith("255")) {
    cleaned = "255" + cleaned;
  }
  return cleaned;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, full_name } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting: max 5 OTPs per 5 minutes per phone
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", normalizedPhone)
      .gte("created_at", fiveMinAgo);

    if ((count ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many OTP requests. Try again in 5 minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otp = generateOTP();

    // Store OTP
    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone: normalizedPhone,
      otp,
      verified: false,
    });

    if (insertError) {
      console.error("OTP insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS via NextSMS
    const nextsmsUsername = Deno.env.get("NEXTSMS_USERNAME")!;
    const nextsmsPassword = Deno.env.get("NEXTSMS_PASSWORD")!;
    const basicAuth = btoa(`${nextsmsUsername}:${nextsmsPassword}`);

    const smsResponse = await fetch(
      "https://messaging-service.co.tz/api/sms/v1/text/single",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          from: "CHUOKKUUSDA",
          to: normalizedPhone,
          text: `Your OTP code is: ${otp}`,
        }),
      }
    );

    if (!smsResponse.ok) {
      const smsError = await smsResponse.text();
      console.error("NextSMS error:", smsResponse.status, smsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send SMS" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await smsResponse.text(); // consume body

    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP sent successfully",
        phone: normalizedPhone,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-otp error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
