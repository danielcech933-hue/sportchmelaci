export type KlipyMediaType = "gifs" | "stickers" | "clips";

export type KlipyImage = {
  url: string;
  width: number;
  height: number;
};

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
const API_BASE = "https://api.klipy.com/api/v1";

export const isKlipyConfigured = () => Boolean(API_KEY);

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapImage(value: any): KlipyImage | null {
  if (!value) return null;
  const url = typeof value === "string" ? value : String(value.url ?? "");
  if (!url) return null;
  return {
    url,
    width: toNumber(typeof value === "string" ? 0 : value.width),
    height: toNumber(typeof value === "string" ? 0 : value.height),
  };
}

function nestedImage(file: any, size: string, format: string): KlipyImage | null {
  return mapImage(file?.[size]?.[format]);
}

function mapItem(raw: any, mediaType: KlipyMediaType): KlipyItem | null {
  const file = raw?.file ?? raw?.files ?? {};
  const preview =
    nestedImage(file, "sm", "gif") ??
    nestedImage(file, "sm", "webp") ??
    nestedImage(file, "preview", "gif") ??
    nestedImage(file, "tiny", "gif") ??
    mapImage(file?.gif);
  const fixedWidth =
    nestedImage(file, "md", "gif") ??
    nestedImage(file, "md", "webp") ??
    nestedImage(file, "hd", "gif") ??
    mapImage(file?.mediumgif) ??
    mapImage(file?.gif);
  const original =
    nestedImage(file, "hd", "gif") ??
    nestedImage(file, "lg", "gif") ??
    mapImage(file?.gif);

  if (!raw?.id || !preview?.url || !fixedWidth?.url || !original?.url) return null;

  return {
    id: String(raw.id),
    title: String(raw.title ?? raw.slug ?? "KLIPY"),
    sourceUrl: String(raw.url ?? raw.page_url ?? "https://klipy.com"),
    preview,
    fixedWidth,
    original,
    mediaType,
  };
}

async function request(path: string, params: Record<string, string>): Promise<KlipyItem[]> {
  if (!API_KEY) throw new Error("KLIPY API není ještě nastavená.");

  const query = new URLSearchParams(params);
  const response = await fetch(`${API_BASE}/${API_KEY}/${path}?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error(`KLIPY API: ${response.status}`);
  const payload = await response.json();
  const rawItems = Array.isArray(payload?.data?.data)
    ? payload.data.data
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.results)
        ? payload.results
        : [];

  return rawItems
    .map((item: any) => mapItem(item, "gifs"))
    .filter(Boolean) as KlipyItem[];
}

export async function searchKlipy(query: string, options?: { limit?: number; page?: number }) {
  return request("gifs/search", {
    q: query.trim(),
    page: String(Math.max(options?.page ?? 1, 1)),
    per_page: String(Math.min(Math.max(options?.limit ?? 24, 1), 50)),
    content_filter: "low",
    locale: "cs_CZ",
  });
}

export async function trendingKlipy(options?: { limit?: number; page?: number }) {
  return request("gifs/trending", {
    page: String(Math.max(options?.page ?? 1, 1)),
    per_page: String(Math.min(Math.max(options?.limit ?? 24, 1), 50)),
    content_filter: "low",
    locale: "cs_CZ",
  });
}
