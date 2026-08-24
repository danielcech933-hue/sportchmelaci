import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !supabaseUrl || !serviceRoleKey) return json({ error: "not_authenticated" }, 401);

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "not_authenticated" }, 401);

  const userClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "not_authenticated" }, 401);

  const apiKey = Deno.env.get("KLIPY_API_KEY")?.trim();
  if (!apiKey) return json({ error: "KLIPY_API_KEY_NOT_CONFIGURED" }, 503);

  try {
    const body = await req.json() as {
      mode?: "search" | "trending";
      query?: string;
      page?: number;
      limit?: number;
      mediaType?: "gifs" | "stickers" | "clips";
    };

    const mediaType = body.mediaType ?? "gifs";
    if (!["gifs", "stickers", "clips"].includes(mediaType)) return json({ error: "unsupported_media_type" }, 400);

    const query = String(body.query ?? "").trim().slice(0, 120);
    const mode = body.mode === "search" || query ? "search" : "trending";
    if (mode === "search" && !query) return json({ error: "missing_query" }, 400);

    const page = Math.max(1, Math.min(1000, Math.floor(body.page ?? 1)));
    const limit = Math.min(50, Math.max(1, Math.floor(body.limit ?? 24)));

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(limit),
      content_filter: "low",
      locale: "cs_CZ",
    });
    if (mode === "search") params.set("q", query);

    const path = mode === "search" ? `${mediaType}/search` : `${mediaType}/trending`;
    const upstream = await fetch(`https://api.klipy.com/api/v1/${apiKey}/${path}?${params.toString()}`, {
      headers: { accept: "application/json" },
    });

    const text = await upstream.text();
    if (!upstream.ok) return json({ error: "klipy_upstream_error", status: upstream.status, detail: text.slice(0, 500) }, 502);

    return json(JSON.parse(text));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
