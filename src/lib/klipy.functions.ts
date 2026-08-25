import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type KlipyInput = {
  mode?: "search" | "trending";
  mediaType?: "gifs" | "stickers" | "clips";
  query?: string;
  page?: number;
  limit?: number;
};

const ALLOWED_MEDIA = ["gifs", "stickers", "clips"] as const;

export const fetchKlipyMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: KlipyInput) => {
    const mediaType = ALLOWED_MEDIA.includes(input?.mediaType as never) ? (input.mediaType as "gifs" | "stickers" | "clips") : "gifs";
    const query = String(input?.query ?? "").trim().slice(0, 120);
    const mode: "search" | "trending" = input?.mode === "search" || query ? "search" : "trending";
    return {
      mediaType,
      query,
      mode,
      page: Math.max(1, Math.min(1000, Math.floor(Number(input?.page ?? 1)) || 1)),
      limit: Math.min(50, Math.max(1, Math.floor(Number(input?.limit ?? 24)) || 24)),
    };
  })
  .handler(async ({ data, context }) => {
    if (data.mode === "search" && !data.query) throw new Error("missing_query");

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const klipyKey = process.env["KLIPY_API_KEY"];
    if (!lovableKey || !klipyKey) throw new Error("KLIPY_NOT_CONFIGURED");

    const params = new URLSearchParams({
      customer_id: context.userId,
      page: String(data.page),
      per_page: String(data.limit),
      content_filter: "low",
      locale: "cs_CZ",
    });
    if (data.mode === "search") params.set("q", data.query);

    const endpoint = `https://connector-gateway.lovable.dev/klipy/${data.mediaType}/${data.mode}?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": klipyKey,
        Accept: "application/json",
      },
    });

    const text = await response.text();
    if (!response.ok) {
      console.error(`KLIPY gateway failed [${response.status}]: ${text.slice(0, 500)}`);
      throw new Error(`KLIPY ${response.status}: ${text.slice(0, 200)}`);
    }

    const payload = JSON.parse(text) as { result?: boolean };
    if (payload?.result === false) {
      console.error(`KLIPY returned result:false — ${text.slice(0, 500)}`);
      throw new Error("KLIPY request failed");
    }
    return payload;
  });
