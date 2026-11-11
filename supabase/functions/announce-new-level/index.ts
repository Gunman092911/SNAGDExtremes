import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    const secondWebhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL_2");
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
      .from("snagd_staff").select("user_id").eq("user_id", userData.user.id).maybeSingle();
    if (staffError || !staff) return json({ error: "Staff access required." }, 403);

    const body = await req.json();
    const eventType = String(body.eventType || "");
    const clean = (value: unknown, max = 100) => String(value ?? "").trim().slice(0, max);
    const levelName = clean(body.levelName);
    const levelId = clean(body.levelId, 30);
    const verifier = clean(body.verifier, 80);
    const username = clean(body.username, 80);
    const percent = clean(body.percent, 10);
    const hz = clean(body.hz, 10);
    const proofUrl = clean(body.proofUrl, 500);
    const rank = clean(body.rank, 10);
    const aboveName = clean(body.aboveName, 100);
    const belowName = clean(body.belowName, 100);
    const listUrl = "https://list.snagd.workers.dev/";

    const events: Record<string, { title: string; description: string; fields: Array<{ name: string; value: string; inline?: boolean }> }> = {
      level_added: {
        title: "A New Level Has Been Added!",
        description: "A new Extreme Demon has been added to the SNAGD list.",
        fields: [
          { name: "Level", value: levelName, inline: true },
          { name: "Level ID", value: levelId, inline: true },
          { name: "Verified by", value: verifier, inline: true },
        ],
      },
      level_request_rejected: {
        title: "A Level Request Was Rejected",
        description: "A submitted level request was reviewed by SNAGD staff.",
        fields: [{ name: "Level", value: levelName, inline: true }, { name: "Level ID", value: levelId, inline: true }],
      },
      level_moved: {
        title: "A Level Has Been Moved!",
        description: "The SNAGD public list has been reordered.",
        fields: [
          { name: "Level", value: levelName, inline: true },
          { name: "New position", value: "#" + rank, inline: true },
          { name: "Placement", value: "Above " + (aboveName || "the top of the list") + " and below " + (belowName || "the bottom of the list") },
        ],
      },
      level_removed: {
        title: "A Level Was Removed",
        description: "A level has been removed from the SNAGD list.",
        fields: [{ name: "Level", value: levelName, inline: true }, { name: "Level ID", value: levelId || "Unknown", inline: true }],
      },
      record_added: {
        title: "A New Record Has Been Added!",
        description: "A player record has been approved and added to the public list.",
        fields: [
          { name: "Player", value: username, inline: true },
          { name: "Level", value: levelName, inline: true },
          { name: "Progress", value: percent + "%", inline: true },
          { name: "Refresh Rate", value: hz + "Hz", inline: true },
          ...(proofUrl ? [{ name: "Proof", value: proofUrl }] : []),
        ],
      },
      record_rejected: {
        title: "A Record Submission Was Rejected",
        description: "A record submission was reviewed by SNAGD staff.",
        fields: [
          { name: "Player", value: username, inline: true },
          { name: "Level", value: levelName, inline: true },
          { name: "Progress", value: percent + "%", inline: true },
        ],
      },
      record_removed: {
        title: "A Record Was Removed",
        description: "A player record has been removed from the public list.",
        fields: [
          { name: "Player", value: username, inline: true },
          { name: "Level", value: levelName, inline: true },
          { name: "Progress", value: percent + "%", inline: true },
        ],
      },
    };

    const event = events[eventType];
    if (!event) return json({ error: "Unknown announcement type." }, 400);
    if (event.fields.some((field) => !field.value || !field.value.trim())) {
      return json({ error: "Some required announcement details are missing." }, 400);
    }

    const webhookUrls = [webhookUrl, secondWebhookUrl].filter((url): url is string => Boolean(url));
    const discordResponses = await Promise.all(webhookUrls.map((url) => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: event.title,
          color: 0x8b5cf6,
          description: event.description,
          fields: event.fields,
          url: listUrl,
          footer: { text: "SNAGD • Extreme Demon List" },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      }),
    })));

    const failedResponse = discordResponses.find((response) => !response.ok);
    if (failedResponse) {
      const detail = await failedResponse.text();
      console.error("One or more Discord webhooks failed:", failedResponse.status, detail);
      return json({ error: "One or more Discord servers rejected the announcement." }, 502);
    }
    return json({ success: true });
  } catch (error) {
    console.error("Announcement error:", error);
    return json({ error: "Could not send the Discord announcement." }, 500);
  }
});
