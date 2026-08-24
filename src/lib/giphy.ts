export type GiphyMediaType = "gifs" | "stickers";

export type GiphyImage = {
  url: string;
  width: number;
  height: number;
};

export type GiphyItem = {
  id: string;
  title: string;
  sourceUrl: string;
  images: {
    preview: GiphyImage;
    fixedWidth: GiphyImage;
    original: GiphyImage;
  };
  rating: string;
};

const API_BASE = "https://api.giphy.com/v1";
const API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;

export function isGiphyConfigured() {
  return Boolean(API_KEY);
}

function mapImage(value: any): GiphyImage {
  return {
    url: String(value?.url ?? ""),
    width: Number(value?.width ?? 0),
    height: Number(value?.height ?? 0),
  };
}

function mapItem(raw: any): GiphyItem | null {
  const images = raw?.images;
  const preview = images?.preview_gif ?? images?.fixed_width_small ?? images?.downsized_small ?? images?.fixed_width;
  const fixedWidth = images?.fixed_width ?? images?.fixed_width_downsampled ?? images?.preview_gif;
  const original = images?.original ?? images?.downsized_large ?? images?.downsized;
  if (!raw?.id || !preview?.url || !fixedWidth?.url || !original?.url) return null;
  return {
    id: String(raw.id),
    title: String(raw.title ?? "GIPHY"),
    sourceUrl: String(raw.url ?? "https://giphy.com"),
    images: {
      preview: mapImage(preview),
      fixedWidth: mapImage(fixedWidth),
      original: mapImage(original),
    },
    rating: String(raw.rating ?? "").toUpperCase(),
  };
}

async function request(path: string, params: Record<string, string>) {
  if (!API_KEY) throw new Error("GIPHY API není ještě nastavená.");
  const search = new URLSearchParams({ api_key: API_KEY, ...params });
  const response = await fetch(`${API_BASE}/${path}?${search.toString()}`);
  if (!response.ok) throw new Error(`GIPHY API: ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data.map(mapItem).filter(Boolean) as GiphyItem[] : [];
}

export async function searchGiphy(query: string, options?: { limit?: number; offset?: number; stickers?: boolean }) {
  const type: GiphyMediaType = options?.stickers ? "stickers" : "gifs";
  const data = await request(`${type}/search`, {
    q: query.trim(),
    limit: String(Math.min(Math.max(options?.limit ?? 24, 1), 50)),
    offset: String(Math.max(options?.offset ?? 0, 0)),
    rating: "pg-13",
    lang: "cs",
  });
  return data;
}

export async function trendingGiphy(options?: { limit?: number; offset?: number; stickers?: boolean }) {
  const type: GiphyMediaType = options?.stickers ? "stickers" : "gifs";
  return request(`${type}/trending`, {
    limit: String(Math.min(Math.max(options?.limit ?? 24, 1), 50)),
    offset: String(Math.max(options?.offset ?? 0, 0)),
    rating: "pg-13",
  });
}
