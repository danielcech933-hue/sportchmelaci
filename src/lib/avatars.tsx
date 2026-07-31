import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
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

function AvatarLightbox({ url, nickname, onClose }: { url: string; nickname?: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={nickname ?? "avatar preview"}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative flex max-h-[90vh] max-w-[92vw] flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={url}
          alt={nickname ?? "avatar"}
          className="max-h-[80vh] max-w-[90vw] rounded-2xl border border-primary/50 object-contain shadow-[0_0_40px_-5px_var(--color-primary)]"
        />
        {nickname && (
          <div className="mt-3 text-center font-display text-lg tracking-widest text-primary neon-text">
            {nickname}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-2 -top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/50 bg-background text-primary shadow-[0_0_20px_-6px_var(--color-primary)] hover:bg-primary hover:text-primary-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function Avatar({
  path,
  nickname,
  size = 32,
  className = "",
  zoomable = true,
}: {
  path?: string | null;
  nickname?: string | null;
  size?: number;
  className?: string;
  zoomable?: boolean;
}) {
  const url = useAvatarUrl(path);
  const [open, setOpen] = useState(false);
  const s = { width: size, height: size } as const;
  const canZoom = zoomable && !!url;
  const Tag: any = canZoom ? "button" : "span";
  return (
    <>
      <Tag
        type={canZoom ? "button" : undefined}
        onClick={
          canZoom
            ? (e: React.MouseEvent) => {
                // zoom only — never bubble into a parent <Link>/row click
                e.preventDefault();
                e.stopPropagation();
                setOpen(true);
              }
            : undefined
        }
        style={s}
        className={`relative inline-flex shrink-0 overflow-hidden rounded-full border border-primary/40 bg-primary/10 ${canZoom ? "cursor-zoom-in transition hover:border-primary hover:shadow-[0_0_16px_-4px_var(--color-primary)]" : ""} ${className}`}
        aria-label={canZoom ? `Zvětšit avatar ${nickname ?? ""}`.trim() : (nickname ?? "avatar")}
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
      </Tag>
      {open && url && <AvatarLightbox url={url} nickname={nickname} onClose={() => setOpen(false)} />}
    </>
  );
}

