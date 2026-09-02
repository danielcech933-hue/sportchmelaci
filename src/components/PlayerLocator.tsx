import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, Radio, ShieldCheck, StopCircle, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const LOCATION_STALE_MS = 15 * 60 * 1000;

type LocatorRow = {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  updated_at: string;
  stale: boolean;
};

type Props = { userId: string; isSelf: boolean; nickname: string | null };

function mapUrl(lat: number, lon: number) {
  const d = 0.012;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d}%2C${lat - d}%2C${lon + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lon}`;
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "právě teď";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `před ${hours} h`;
}

export function PlayerLocator({ userId, isSelf, nickname }: Props) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [visibility, setVisibility] = useState<"off" | "authenticated">("off");
  const [row, setRow] = useState<LocatorRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const resetLocation = useCallback(async () => {
    stopWatching();
    if (!user) return;
    await (supabase as any).from("user_locations").delete().eq("user_id", user.id);
    setEnabled(false);
    setVisibility("off");
    setRow(null);
  }, [stopWatching, user]);

  const savePosition = useCallback(async (position: GeolocationPosition) => {
    if (!user) return;
    const next = {
      user_id: user.id,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_m: position.coords.accuracy ?? null,
      enabled: true,
      visibility: "authenticated",
      updated_at: new Date().toISOString(),
    };
    const { error: dbError } = await (supabase as any).from("user_locations").upsert(next, { onConflict: "user_id" });
    if (dbError) throw dbError;
    setEnabled(true);
    setVisibility("authenticated");
    setRow((current) => ({ ...(current ?? { user_id: user.id, stale: false }), ...next, stale: false }));
  }, [user]);

  const startSharing = useCallback(async () => {
    if (!user || !navigator.geolocation) {
      setError("Tento prohlížeč nepodporuje lokalizaci.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await savePosition(position);
          stopWatching();
          watchRef.current = navigator.geolocation.watchPosition(
            (next) => void savePosition(next),
            (watchError) => setError(watchError.message),
            { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Lokaci se nepodařilo uložit.");
        } finally {
          setBusy(false);
        }
      },
      (watchError) => {
        setError(watchError.message || "Přístup k poloze nebyl povolen.");
        setBusy(false);
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 20_000 },
    );
  }, [savePosition, stopWatching, user]);

  const loadSelf = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("user_locations").select("user_id,latitude,longitude,accuracy_m,enabled,visibility,updated_at").eq("user_id", user.id).maybeSingle();
    setEnabled(Boolean(data?.enabled));
    setVisibility(data?.visibility === "authenticated" ? "authenticated" : "off");
    if (data?.enabled && data?.visibility === "authenticated") {
      setRow({ ...data, stale: Date.now() - new Date(data.updated_at).getTime() > LOCATION_STALE_MS });
    } else {
      setRow(null);
    }
  }, [user]);

  const loadPublic = useCallback(async () => {
    if (!user || !userId) return;
    const { data, error: rpcError } = await (supabase as any).rpc("get_public_user_location", { _user_id: userId });
    if (rpcError) {
      setError(null);
      setRow(null);
      return;
    }
    const next = Array.isArray(data) ? data[0] : data;
    setRow(next ? { ...next, stale: Boolean(next.stale) || Date.now() - new Date(next.updated_at).getTime() > LOCATION_STALE_MS } : null);
  }, [user, userId]);

  useEffect(() => {
    if (!user) return;
    if (isSelf) void loadSelf();
    else void loadPublic();
  }, [isSelf, loadPublic, loadSelf, user]);

  useEffect(() => () => stopWatching(), [stopWatching]);

  const status = useMemo(() => {
    if (!row || !enabled && isSelf) return "off";
    return row.stale ? "stale" : "online";
  }, [enabled, isSelf, row]);

  const title = isSelf ? "PLAYER LOCATOR" : `${nickname ?? "HRÁČ"} // LOCATOR`;

  return (
    <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-accent/20 bg-background/55 shadow-[0_25px_70px_-45px_var(--color-accent)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/15 bg-accent/5 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-[0_0_24px_-10px_var(--color-accent)]"><LocateFixed className="h-4 w-4" /></div>
          <div><p className="font-mono text-[9px] uppercase tracking-[0.35em] text-accent/80">// REAL-TIME POSITION</p><h2 className="font-display text-xl tracking-[0.14em] text-foreground">{title}</h2></div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${status === "online" ? "animate-pulse bg-accent shadow-[0_0_10px_var(--color-accent)]" : status === "stale" ? "bg-primary" : "bg-muted-foreground"}`} />
          {status === "online" ? "ONLINE" : status === "stale" ? "STALE" : "OFF"}
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-accent/15 bg-[#07110d]">
          {row ? (
            <iframe title={`${title} mapa`} loading="lazy" className="absolute inset-0 h-full w-full border-0 opacity-85 grayscale-[0.15] contrast-110" src={mapUrl(row.latitude, row.longitude)} />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center"><div><MapPin className="mx-auto h-8 w-8 text-accent/60" /><p className="mt-3 font-display text-xl tracking-wider text-muted-foreground">POLOHA NENÍ SDÍLENÁ</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Na veřejném profilu se poloha zobrazí jen pokud ji hráč výslovně zapne. Přesná GPS data nejsou veřejně vystavena.</p></div></div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,204,68,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,204,68,.07)_1px,transparent_1px)] bg-[size:32px_32px] mix-blend-screen opacity-70" />
          {row && <div className="absolute left-3 top-3 rounded-lg border border-accent/25 bg-background/75 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-accent backdrop-blur">LOC LOCKED · ±~100M</div>}
        </div>

        <div className="flex flex-col justify-between gap-4">
          {isSelf ? (
            <div className="rounded-2xl border border-primary/15 bg-background/45 p-4">
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><div><p className="text-sm font-semibold">Soukromí pod kontrolou</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Sdílení je ve výchozím stavu vypnuté. Ostatní přihlášení hráči vidí jen přibližnou polohu a čas poslední aktualizace.</p></div></div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!enabled ? (
                  <button type="button" disabled={busy} onClick={() => void startSharing()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-8px_var(--color-primary)] disabled:opacity-50"><Radio className="h-4 w-4" /> {busy ? "Spouštím…" : "Sdílet moji polohu"}</button>
                ) : (
                  <button type="button" onClick={() => void resetLocation()} className="inline-flex items-center gap-2 rounded-xl border border-danger/35 bg-danger/5 px-3.5 py-2.5 text-xs font-semibold text-danger hover:bg-danger/10"><StopCircle className="h-4 w-4" /> Přestat sdílet</button>
                )}
                <span className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-background/40 px-3.5 py-2.5 text-xs text-muted-foreground"><Wifi className="h-3.5 w-3.5 text-accent" /> {visibility === "authenticated" && enabled ? "Přihlášení hráči" : "Vypnuto"}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Wifi className="h-4 w-4 text-accent" /> Locator status</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{row ? (row.stale ? "Poslední známá poloha je starší než 15 minut." : "Hráč momentálně sdílí přibližnou polohu.") : "Hráč polohu nesdílí nebo ji právě vypnul."}</p>
            </div>
          )}

          {error && <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</div>}
          {row && <div className="rounded-2xl border border-accent/15 bg-accent/5 p-4"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">LAST TELEMETRY</p><p className="mt-1 font-display text-xl tracking-wider text-accent">{relativeTime(row.updated_at)}</p><p className="mt-1 text-xs text-muted-foreground">Poloha je záměrně zaokrouhlená. Přesné souřadnice se na profilu nikdy nezobrazují.</p></div>}
          {!isSelf && !row && <div className="rounded-2xl border border-border/50 bg-background/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><WifiOff className="h-4 w-4" /> SIGNAL OFFLINE</div></div>}
        </div>
      </div>
    </section>
  );
}
