export type MediaMessage =
  | { type: "image"; path: string; caption?: string }
  | { type: "gif"; url: string; title?: string; source?: string };

const PREFIX = "__SC_MEDIA__:";

export function encodeMediaMessage(media: MediaMessage): string {
  return PREFIX + JSON.stringify(media);
}

export function parseMediaMessage(content: string): MediaMessage | null {
  if (!content.startsWith(PREFIX)) return null;
  try {
    const value = JSON.parse(content.slice(PREFIX.length)) as Partial<MediaMessage>;
    if (value.type === "image" && typeof value.path === "string") {
      return { type: "image", path: value.path, caption: typeof value.caption === "string" ? value.caption : undefined };
    }
    if (value.type === "gif" && typeof value.url === "string") {
      return { type: "gif", url: value.url, title: typeof value.title === "string" ? value.title : undefined, source: typeof value.source === "string" ? value.source : undefined };
    }
  } catch {
    // Legacy/plain text messages are intentionally left untouched.
  }
  return null;
}

export const SPORTS_GIF_QUERIES = [
  { label: "⚽ Fotbal", query: "football goal celebration" },
  { label: "🏒 Hokej", query: "hockey celebration" },
  { label: "🎾 Tenis", query: "tennis celebration" },
  { label: "🏀 Basket", query: "basketball celebration" },
  { label: "🏐 Volejbal", query: "volleyball celebration" },
  { label: "🎯 Šipky", query: "darts celebration" },
  { label: "🏆 Vítězství", query: "sports victory celebration" },
];

export const EMOJI = [
  "😀","😂","🤣","😎","🤩","😤","😭","😱","🤔","🥳","🤝","🔥","⚡","💪","👏","🙌","👀","❤️","💚","💛","⚽","🏆","🥇","🥈","🥉","🎯","🏀","🏒","🎾","🏐","🎱","🍺","🎉","💥","🚀","🐐",
];
