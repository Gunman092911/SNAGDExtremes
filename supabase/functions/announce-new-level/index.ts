import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");

    if (!supabaseUrl || !anonKey || !webhookUrl) {
      return json({ error: "The announcement function is not fully configured." }, 500);
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Sign-in required." }, 401);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "Invalid session." }, 401);

    const { data: staff, error: staffError } = await supabase
      .from("snagd_staff")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (staffError || !staff) return json({ error: "Staff access required." }, 403);

    const body = await req.json();
    const levelName = String(body.levelName || "").trim().slice(0, 100);
    const levelId = String(body.levelId || "").trim().slice(0, 30);
    const verifier = String(body.verifier || "").trim().slice(0, 80);
    const listUrl = "https://list.snagd.workers.dev/";

    if (!levelName || !levelId || !verifier) {
      return json({ error: "Level name, ID, and verifier are required." }, 400);
    }

    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: null,
        embeds: [{
          title: "A New Level Has Been Added!",
          color: 0x8b5cf6,
          fields: [
            { name: "Level", value: levelName, inline: true },
            { name: "Level ID", value: levelId, inline: true },
            { name: "Verified by", value: verifier, inline: true },
          ],
          description: "A new Extreme Demon has been added to the SNAGD list.",
          url: listUrl,
          footer: { text: "SNAGD • Extreme Demon List" },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      }),
    });

    if (!discordResponse.ok) {
      const detail = await discordResponse.text();
      console.error("Discord webhook failed:", discordResponse.status, detail);
      return json({ error: "Discord rejected the announcement." }, 502);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Announcement error:", error);
    return json({ error: "Could not send the Discord announcement." }, 500);
  }
});
