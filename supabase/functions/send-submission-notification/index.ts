import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Sign-in required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || publishableKeys.default;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secretKeys.default;
    if (!anonKey || !serviceKey) return respond({ error: "Supabase function keys are unavailable" }, 500);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("EMAIL_FROM");

    if (!resendKey || !fromEmail) {
      return respond({ error: "Email delivery is not configured yet. Add RESEND_API_KEY and EMAIL_FROM secrets to this Edge Function." }, 503);
    }

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) return respond({ error: "Invalid sign-in session" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: staff, error: staffError } = await admin
      .from("snagd_staff").select("user_id").eq("user_id", userData.user.id).maybeSingle();
    if (staffError || !staff) return respond({ error: "Staff access required" }, 403);

    const { submissionId } = await req.json();
    if (!submissionId) return respond({ error: "Missing submissionId" }, 400);

    const { data: submission, error: submissionError } = await admin
      .from("snagd_submissions")
      .select("id, user_id, username, level_name, percent, status")
      .eq("id", submissionId).maybeSingle();
    if (submissionError || !submission) return respond({ error: "Submission not found" }, 404);
    if (!["approved", "rejected"].includes(submission.status)) {
      return respond({ error: "Submission has not been reviewed" }, 400);
    }
    if (!submission.user_id) return respond({ error: "This older submission is not linked to a player account" }, 409);

    const { data: playerData, error: playerError } = await admin.auth.admin.getUserById(submission.user_id);
    const email = playerData?.user?.email;
    if (playerError || !email) return respond({ error: "Could not find the player's account email" }, 404);

    const accepted = submission.status === "approved";
    const subject = accepted
      ? `Your SNAGD record for ${submission.level_name} was accepted!`
      : `An update on your SNAGD record for ${submission.level_name}`;
    const statusText = accepted ? "accepted" : "not accepted";
    const safe = (value: unknown) => String(value ?? "").replace(/[&<>"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
    }[char]!));

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#20212a"><h1 style="font-size:24px">SNAGD record update</h1><p>Hi ${safe(submission.username)},</p><p>Your record for <strong>${safe(submission.level_name)}</strong> (${submission.percent}%) was <strong>${statusText}</strong>.</p><p>${accepted ? "Congratulations! Your record has been approved and will be reflected on the list." : "Your record was not approved. Please check the submission requirements or contact the list staff if you have questions."}</p><p style="margin-top:28px;color:#777">SNAGD Extremes</p></div>`,
      }),
    });
    const result = await response.json();
    if (!response.ok) return respond({ error: result.message || "Email provider rejected the message" }, 502);
    return respond({ success: true });
  } catch (error) {
    return respond({ error: error?.message || "Unexpected error" }, 500);
  }
});

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
