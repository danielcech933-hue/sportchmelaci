import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type DirectoryEntry = { id: string; nickname: string; avatar_path: string | null };

let cache: DirectoryEntry[] | null = null;
let inflight: Promise<DirectoryEntry[]> | null = null;
const listeners = new Set<(d: DirectoryEntry[]) => void>();

export async function loadProfileDirectory(): Promise<DirectoryEntry[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = supabase
      .from("profiles")
      .select("id,nickname,avatar_path")
      .then(({ data }) => {
        cache = ((data ?? []) as DirectoryEntry[]).filter((p) => !!p.nickname);
        listeners.forEach((l) => l(cache!));
        return cache;
      });
  }
  return inflight;
}

/** Map of lowercase nickname -> profile entry. */
export function useProfileDirectory() {
  const [dir, setDir] = useState<DirectoryEntry[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    const l = (d: DirectoryEntry[]) => { if (alive) setDir(d); };
    listeners.add(l);
    loadProfileDirectory().then(l);
    return () => { alive = false; listeners.delete(l); };
  }, []);
  const byNick = new Map<string, DirectoryEntry>();
  for (const p of dir) byNick.set(p.nickname.trim().toLowerCase(), p);
  return { profiles: dir, byNick };
}

export function useProfileIdByNickname(nickname?: string | null): string | null {
  const { byNick } = useProfileDirectory();
  if (!nickname) return null;
  return byNick.get(nickname.trim().toLowerCase())?.id ?? null;
}

/**
 * Renders a nickname that links to that user's public profile when the
 * nickname belongs to a registered account; otherwise plain text.
 */
export function NickLink({
  nickname,
  userId,
  className = "",
}: {
  nickname?: string | null;
  userId?: string | null;
  className?: string;
}) {
  const resolved = useProfileIdByNickname(userId ? null : nickname);
  const id = userId ?? resolved;
  if (!nickname) return null;
  if (!id) return <span className={className}>{nickname}</span>;
  return (
    <Link
      to="/profile/$id"
      params={{ id }}
      onClick={(e) => e.stopPropagation()}
      className={`transition hover:text-primary hover:underline ${className}`}
    >
      {nickname}
    </Link>
  );
}
