import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();
const TTL_SEC = 60 * 60 * 24 * 7; // 7 days
const REFRESH_BEFORE = 60 * 60 * 1000; // 1h

export async function getAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expires - now > REFRESH_BEFORE) return hit.url;
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, TTL_SEC);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, expires: now + TTL_SEC * 1000 });
  return data.signedUrl;
}

export function invalidateAvatar(path: string | null | undefined) {
  if (path) cache.delete(path);
}

export function useAvatarUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!path) return;
    getAvatarUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function initialsFrom(nickname: string | null | undefined): string {
  if (!nickname) return "?";
  const parts = nickname.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase() || "?";
}

export function Avatar({
  path,
  nickname,
  size = 32,
  className = "",
}: {
  path?: string | null;
  nickname?: string | null;
  size?: number;
  className?: string;
}) {
  const url = useAvatarUrl(path);
  const s = { width: size, height: size } as const;
  return (
    <span
      style={s}
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full border border-primary/40 bg-primary/10 ${className}`}
      aria-label={nickname ?? "avatar"}
    >
      {url ? (
        <img
          src={url}
          alt={nickname ?? "avatar"}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-display text-primary neon-text"
          style={{ fontSize: Math.max(10, Math.floor(size * 0.42)) }}
        >
          {initialsFrom(nickname)}
        </span>
      )}
    </span>
  );
}
