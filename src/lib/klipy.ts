import { fetchKlipyMedia } from "@/lib/klipy.functions";

export type KlipyMediaType = "gifs" | "stickers" | "clips";
export type KlipyImage = { url: string; width: number; height: number };
export type KlipyItem = {
  id: string;
  title: string;
  sourceUrl: string;
  preview: KlipyImage;
  fixedWidth: KlipyImage;
  original: KlipyImage;
  mediaType: KlipyMediaType;
};

const API_KEY = (import.meta.env.VITE_KLIPY_API_KEY as string | undefined)?.trim();
const USE_PROXY = String(import.meta.env.VITE_KLIPY_USE_PROXY ?? "true") !== "false";
const API_BASE = "https://api.klipy.com/api/v1";
export const isKlipyConfigured = () => Boolean(API_KEY) || USE_PROXY;

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapImage(value: any): KlipyImage | null {
  if (!value) return null;
  const url = typeof value === "string" ? value : String(value.url ?? "");
  if (!url) return null;
  return { url, width: toNumber(typeof value === "string" ? 0 : value.width), height: toNumber(typeof value === "string" ? 0 : value.height) };
}

function nestedImage(file: any, size: string, format: string) {
  return mapImage(file?.[size]?.[format]);
}

function mapItem(raw: any, mediaType: KlipyMediaType): KlipyItem | null {
  const file = raw?.file ?? raw?.files ?? {};
  const preview = nestedImage(file, "sm", "gif") ?? nestedImage(file, "sm", "webp") ?? nestedImage(file, "preview", "gif") ?? nestedImage(file, "tiny", "gif") ?? mapImage(file?.gif);
  const fixedWidth = nestedImage(file, "md", "gif") ?? nestedImage(file, "md", "webp") ?? nestedImage(file, "hd", "gif") ?? mapImage(file?.mediumgif) ?? mapImage(file?.gif);
  const original = nestedImage(file, "hd", "gif") ?? nestedImage(file, "lg", "gif") ?? mapImage(file?.gif);
  if (!raw?.id || !preview?.url || !fixedWidth?.url || !original?.url) return null;
  return { id: String(raw.id), title: String(raw.title ?? raw.slug ?? "KLIPY"), sourceUrl: String(raw.url ?? raw.page_url ?? "https://klipy.com"), preview, fixedWidth, original, mediaType };
}

function mapPayload(payload: any, mediaType: KlipyMediaType): KlipyItem[] {
  const rawItems = Array.isArray(payload?.data?.data) ? payload.data.data : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.results) ? payload.results : [];
  return rawItems.map((item: any) => mapItem(item, mediaType)).filter(Boolean) as KlipyItem[];
}

async function requestViaProxy(mode: "search" | "trending", mediaType: KlipyMediaType, params: { query?: string; page?: number; limit?: number }) {
  const data = await fetchKlipyMedia({
    data: {
      mode,
      mediaType,
      query: params.query,
      page: Math.max(params.page ?? 1, 1),
      limit: Math.min(Math.max(params.limit ?? 24, 1), 50),
    },
  });
  return mapPayload(data, mediaType);
}

async function requestDirect(path: string, params: Record<string, string>, mediaType: KlipyMediaType) {
  if (!API_KEY) throw new Error("KLIPY API není ještě nastavená.");
  const response = await fetch(`${API_BASE}/${API_KEY}/${path}?${new URLSearchParams(params).toString()}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`KLIPY API: ${response.status}`);
  return mapPayload(await response.json(), mediaType);
}

export async function searchKlipy(query: string, options?: { limit?: number; page?: number }) {
  if (USE_PROXY) return requestViaProxy("search", "gifs", options ? { ...options, query } : { query });
  return requestDirect("gifs/search", { q: query.trim(), page: String(Math.max(options?.page ?? 1, 1)), per_page: String(Math.min(Math.max(options?.limit ?? 24, 1), 50)), content_filter: "low", locale: "cs_CZ" }, "gifs");
}

export async function trendingKlipy(options?: { limit?: number; page?: number }) {
  if (USE_PROXY) return requestViaProxy("trending", "gifs", options ?? {});
  return requestDirect("gifs/trending", { page: String(Math.max(options?.page ?? 1, 1)), per_page: String(Math.min(Math.max(options?.limit ?? 24, 1), 50)), content_filter: "low", locale: "cs_CZ" }, "gifs");
}
