import { AnimatePresence, motion } from "framer-motion";
import { Activity, Coins, Radio, Users, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type TournamentRow = { id: string; name: string; status: string; max_players: number; hand?: { pot?: number; stage?: string; deadline?: number } | null };
type SeatRow = { tournament_id: string; nickname: string; seat_no: number; chips: number };

export function PokerLiveSyncHUD() {
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [pulse, setPulse] = useState(false);
  const [lastEvent, setLastEvent] = useState("SYNCING LIVE STATE");

  const load = useCallback(async () => {
    const [{ data: tourData }, { data: seatData }] = await Promise.all([
      supabase.rpc("poker_list_tournaments" as any),
      supabase.from("poker_seats").select("tournament_id,nickname,seat_no,chips").order("seat_no"),
    ]);
    setTournaments((tourData ?? []) as TournamentRow[]);
    setSeats((seatData ?? []) as SeatRow[]);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 700);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("poker-live-hud")
      .on("postgres_changes", { event: "*", schema: "public", table: "poker_seats" }, () => {
        setLastEvent("SEAT UPDATE");
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "poker_tournaments" }, () => {
        setLastEvent("TABLE UPDATE");
        void load();
      })
      .subscribe();
    const tick = window.setInterval(() => void load(), 2500);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(tick);
    };
  }, [load]);

  const running = tournaments.filter((t) => t.status === "running");
  const active = running[0] ?? tournaments[0];
  const activeSeats = active ? seats.filter((s) => s.tournament_id === active.id) : [];
  const totalChips = activeSeats.reduce((sum, s) => sum + Number(s.chips || 0), 0);
  const deadline = Number(active?.hand?.deadline || 0);
  const seconds = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;

  return (
    <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <motion.span animate={pulse ? { scale: [1, 1.18, 1] } : { scale: 1 }} className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-300"><Radio className="h-4 w-4" /></motion.span>
          <div>
            <div className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/40">MULTIPLAYER LIVE SYNC</div>
            <div className="font-mono text-[10px] font-black uppercase tracking-[.12em] text-emerald-300">{active ? active.name : "NO ACTIVE TABLE"}</div>
          </div>
        </div>
        <span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/30">{lastEvent}</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric icon={<Users />} label="PLAYERS" value={`${activeSeats.length}/${active?.max_players ?? 0}`} />
        <Metric icon={<Coins />} label="TOTAL CHIPS" value={totalChips.toLocaleString("cs-CZ")} />
        <Metric icon={<Activity />} label="STAGE" value={String(active?.hand?.stage ?? "LOBBY").toUpperCase()} />
        <Metric icon={<Zap />} label="TURN" value={seconds ? `${seconds}s` : "—"} />
      </div>

      <AnimatePresence mode="popLayout">
        {activeSeats.slice(0, 6).map((seat) => (
          <motion.div key={`${seat.tournament_id}-${seat.seat_no}`} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="mt-2 flex items-center justify-between rounded-lg border border-white/7 bg-white/[.02] px-2.5 py-2">
            <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-white/5 font-mono text-[8px] font-black text-white/45">{seat.seat_no + 1}</span><span className="font-display text-sm tracking-wide text-white/85">{seat.nickname}</span></div>
            <span className={cn("font-mono text-[9px] font-black", Number(seat.chips) > 0 ? "text-amber-200" : "text-red-400")}>{Number(seat.chips).toLocaleString("cs-CZ")}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-white/7 bg-white/[.02] p-2.5"><div className="flex items-center gap-1.5 text-white/35"><span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span><span className="font-mono text-[7px] font-black uppercase tracking-[.18em]">{label}</span></div><div className="mt-1 font-display text-sm tracking-wider text-white/90">{value}</div></div>;
}
