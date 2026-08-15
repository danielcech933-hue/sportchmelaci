import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, LogOut, Plus, Timer, Trash2, Users, Sparkles, Crown, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CasinoChat, FlyingEmoji } from "@/components/CasinoChat";
import { CountUp, MagneticText, TiltCard } from "@/lib/fx";
import { cn } from "@/lib/utils";

type Card = { r: number; s: "s" | "h" | "d" | "c" };
type PokerPlayer = { userId: string; nickname: string; chips: number; bet: number; contrib: number; folded: boolean; allIn: boolean; acted: boolean; raiseAllowed?: boolean; holeCards?: Card[] };
type Hand = { id: string; players: PokerPlayer[]; community: number; communityCards?: Card[]; pot: number; stage: "preflop" | "flop" | "turn" | "river" | "done"; toAct: number; currentBet: number; minRaise: number; dealer: number; dealerUserId?: string; deadline: number; blind: number; log: string[]; winners: { userId: string; nickname: string; amount: number; label: string }[] | null };
type Tournament = { id: string; name: string; buy_in: number; starting_chips: number; max_players: number; status: string; hand: Hand | null; created_by: string };
type Seat = { id: string; tournament_id: string; user_id: string; nickname: string; seat_no: number; chips: number };

type RpcResult = { ok: boolean; error?: string; result?: any };

const TURN_SECONDS = 25;
const suitLabel: Record<Card["s"], string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
const rankLabel = (r: number) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[r] ?? String(r);
const cardLabel = (c: Card) => `${rankLabel(c.r)}${suitLabel[c.s]}`;
const redCard = (c: Card) => c.s === "h" || c.s === "d";

function mapError(error: any): string {
  const raw = String(error?.message ?? error ?? "");
  const map: Record<string, string> = {
    insufficient_balance: "Nemáš dostatek dolarů na buy-in.",
    table_full: "Stůl je plný.",
    registration_closed: "Registrace už je uzavřená.",
    not_enough_players: "Ke spuštění jsou potřeba alespoň 2 hráči.",
    hand_in_progress: "Handa už probíhá.",
    not_your_turn: "Teď nejsi na tahu.",
    turn_expired: "Čas na tah vypršel — hráč bude automaticky složen.",
    cannot_check: "Check není možný proti aktuální sázce.",
    nothing_to_call: "Není co dorovnávat.",
    raise_too_small: "Navýšení je pod minimálním raisem.",
    raise_too_large: "Navýšení přesahuje tvůj stack.",
    raise_not_reopened: "Po krátkém all-inu už toto kolo nemáš právo znovu raisovat.",
    invalid_raise: "Neplatné navýšení.",
    no_active_hand: "Aktivní handa už neběží.",
    cashout_not_available: "Cash-out je dostupný až po skončení turnaje.",
    not_tournament_owner: "Pouze zakladatel může turnaj zrušit.",
    tournament_closed: "Turnaj už je uzavřený.",
    not_seated: "Nejsi u tohoto stolu.",
  };
  const key = Object.keys(map).find((k) => raw.includes(k));
  return key ? map[key] : raw || "Operace se nepovedla.";
}

function HoleCard({ card, hidden, delay = 0 }: { card?: Card; hidden?: boolean; delay?: number }) {
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ delay: delay / 1000, duration: 0.22 }} className={cn("relative flex h-16 w-12 select-none items-center justify-center rounded-xl border text-sm font-black shadow-xl sm:h-20 sm:w-14", hidden || !card ? "border-amber-500/35 bg-gradient-to-br from-amber-950/80 via-black to-zinc-950 text-amber-500/30" : redCard(card) ? "border-red-500/50 bg-gradient-to-b from-zinc-900 to-black text-red-400" : "border-zinc-300/40 bg-gradient-to-b from-zinc-800 to-black text-zinc-100")}>{hidden || !card ? <Crown className="h-5 w-5 text-amber-500/50" /> : <span className="font-mono">{cardLabel(card)}</span>}</motion.div>
  );
}

export function LivePokerTournament() {
  const { user, balance, refreshProfile } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", buyIn: 50, chips: 1000, players: 6 });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t, error: te }, { data: s, error: se }] = await Promise.all([
      supabase.rpc("poker_list_tournaments" as any),
      supabase.from("poker_seats").select("*").order("seat_no"),
    ]);
    if (te) toast.error(mapError(te));
    if (se) console.error("Poker seats load error", se);
    setTournaments((t ?? []) as Tournament[]);
    setSeats((s ?? []) as Seat[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("poker-seats-live").on("postgres_changes", { event: "*", schema: "public", table: "poker_seats" }, () => void load()).subscribe();
    const timer = window.setInterval(() => void load(), 2000);
    return () => { supabase.removeChannel(channel); window.clearInterval(timer); };
  }, [load]);

  const create = async () => {
    if (!user) return toast.error("Pro založení turnaje se přihlas.");
    if (!form.name.trim()) return toast.error("Zadej název turnaje.");
    const { data, error } = await supabase.rpc("poker_create_tournament", { _name: form.name.trim(), _buy_in: form.buyIn, _starting_chips: form.chips, _max_players: form.players });
    if (error) return toast.error(mapError(error));
    toast.success("Turnaj byl založen.");
    setCreating(false);
    setForm({ name: "", buyIn: 50, chips: 1000, players: 6 });
    await load();
    if (data) setOpenId(data as string);
  };

  const join = async (t: Tournament) => {
    if (!user) return toast.error("Pro připojení se přihlas.");
    if (balance < Number(t.buy_in)) return toast.error("Nedostatek prostředků na buy-in.");
    const { error } = await supabase.rpc("poker_join", { _tournament_id: t.id });
    if (error) return toast.error(mapError(error));
    await refreshProfile();
    setOpenId(t.id);
    await load();
  };

  const cancel = async (id: string) => {
    const { data, error } = await supabase.rpc("poker_cancel_tournament", { _tournament_id: id });
    if (error) return toast.error(mapError(error));
    toast.success(`Turnaj zrušen. Vráceno $${Number((data as { refunded?: number } | null)?.refunded ?? 0).toFixed(2)}.`);
    await refreshProfile();
    setOpenId(null);
    await load();
  };

  const open = tournaments.find((t) => t.id === openId) ?? null;
  if (open) return <PokerTable tournament={open} seats={seats.filter((s) => s.tournament_id === open.id).sort((a,b) => a.seat_no-b.seat_no)} onBack={() => setOpenId(null)} onRefresh={load} onCancel={() => void cancel(open.id)} />;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-black/80 to-slate-950/90 p-6 backdrop-blur-xl shadow-2xl shadow-amber-500/5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div><span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-amber-400"><Sparkles className="h-3 w-3" /> Server Authoritative</span><MagneticText text="TEXAS HOLD'EM POKER" className="font-display mt-2 text-3xl font-black tracking-wider text-amber-200 sm:text-4xl" /><p className="mt-1 text-xs text-amber-200/60">Karty, žetony, tahy, side poty a výhry počítá server. Refresh už nerozbije rozehranou handu.</p></div>
          <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 font-mono text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-amber-500/20"><Plus className="h-4 w-4" />{creating ? "Zavřít" : "Vytvořit turnaj"}</button>
        </div>
      </div>
      <AnimatePresence>{creating && <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} className="overflow-hidden"><div className="rounded-3xl border border-amber-500/30 bg-black/80 p-6"><h3 className="mb-4 flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-amber-400"><Crown className="h-4 w-4" /> Parametry stolu</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5"><span className="font-mono text-[10px] uppercase text-zinc-400">Název</span><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Royal High Rollers" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-amber-100 outline-none focus:border-amber-500" /></label>
        <label className="space-y-1.5"><span className="font-mono text-[10px] uppercase text-zinc-400">Buy-In $</span><input type="number" min={1} value={form.buyIn} onChange={e=>setForm(f=>({...f,buyIn:Math.max(1,Number(e.target.value)||1)}))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-amber-100 outline-none" /></label>
        <label className="space-y-1.5"><span className="font-mono text-[10px] uppercase text-zinc-400">Startovní chips</span><input type="number" min={100} value={form.chips} onChange={e=>setForm(f=>({...f,chips:Math.max(100,Number(e.target.value)||100)}))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-amber-100 outline-none" /></label>
        <label className="space-y-1.5"><span className="font-mono text-[10px] uppercase text-zinc-400">Hráči 2–9</span><input type="number" min={2} max={9} value={form.players} onChange={e=>setForm(f=>({...f,players:Math.min(9,Math.max(2,Number(e.target.value)||2))}))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-amber-100 outline-none" /></label>
      </div><button onClick={create} className="mt-5 w-full rounded-xl bg-amber-500 py-3 font-mono text-xs font-black uppercase tracking-widest text-black">Založit turnaj</button></div></motion.div>}</AnimatePresence>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.length===0 && <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 p-12 text-center"><Coins className="mb-2 h-10 w-10 text-zinc-600" /><p className="text-sm text-zinc-400">{loading?"Načítám poker stoly…":"Zatím tu není žádný aktivní turnaj."}</p></div>}
        {tournaments.map(t=>{const ts=seats.filter(s=>s.tournament_id===t.id);const seated=ts.some(s=>s.user_id===user?.id);return <TiltCard key={t.id} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-black/90 p-5"><div className="flex items-start justify-between gap-2"><div><h3 className="font-display text-xl font-bold text-amber-100">{t.name}</h3><div className="mt-1 flex gap-2"><span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-400">BUY-IN ${Number(t.buy_in).toFixed(0)}</span><span className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-300">{t.starting_chips} chips</span></div></div>{t.created_by===user?.id && <button onClick={()=>void cancel(t.id)} className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-400"><Trash2 className="h-4 w-4" /></button>}</div><div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-xs"><span className="inline-flex items-center gap-1.5 font-mono text-zinc-400"><Users className="h-3.5 w-3.5 text-amber-400" />{ts.length}/{t.max_players}</span><span className={cn("font-mono text-[10px] font-bold uppercase",t.status==='running'?"text-emerald-400":"text-amber-400")}>{t.status==='running'?"HRA PROBÍHÁ":"LOBBY"}</span></div><button onClick={()=>seated?setOpenId(t.id):void join(t)} className={cn("mt-4 w-full rounded-xl py-2.5 font-mono text-xs font-black uppercase tracking-widest",seated?"border border-amber-500/50 bg-amber-500/15 text-amber-300":"bg-white/10 text-white hover:bg-amber-500 hover:text-black")}>{seated?"Ke stolu":"Připojit se"}</button></TiltCard>})}
      </div>
    </div>
  );
}

function PokerTable({ tournament, seats, onBack, onRefresh, onCancel }: { tournament: Tournament; seats: Seat[]; onBack: ()=>void; onRefresh: ()=>Promise<void>|void; onCancel: ()=>void }) {
  const { user, refreshProfile } = useAuth();
  const hand=tournament.hand;
  const [raise,setRaise]=useState(0);
  const [busy,setBusy]=useState(false);
  const [emojis,setEmojis]=useState<{id:number;emoji:string}[]>([]);
  const mySeat=seats.find(s=>s.user_id===user?.id);
  const myPlayer=hand?.players.find(p=>p.userId===user?.id);
  const myIdx=hand?.players.findIndex(p=>p.userId===user?.id) ?? -1;
  const myTurn=!!hand && hand.stage!=='done' && hand.toAct===myIdx;
  const toCall=hand&&myPlayer?Math.max(0,hand.currentBet-myPlayer.bet):0;
  const maxRaise=hand&&myPlayer?myPlayer.bet+myPlayer.chips:0;
  const minRaise=hand?Math.max(hand.blind,hand.currentBet+hand.minRaise):0;
  const secondsLeft=hand?Math.max(0,Math.ceil((hand.deadline-Date.now())/1000)):0;
  const board=useMemo(()=>hand?.communityCards??[],[hand?.communityCards]);

  useEffect(()=>{if(hand&&myPlayer)setRaise(Math.min(maxRaise,Math.max(minRaise,maxRaise)));},[hand?.currentBet,hand?.minRaise,myPlayer?.chips,myPlayer?.bet]);
  useEffect(()=>{if(!hand||hand.stage==='done'||!mySeat)return;const timer=window.setInterval(async()=>{const {data,error}=await supabase.rpc("poker_tick",{_tournament_id:tournament.id});if(error&& !String(error.message).includes("turn_expired")) return; if(data) await onRefresh();},2000);return()=>window.clearInterval(timer);},[hand?.id,hand?.stage,mySeat?.id,tournament.id,onRefresh]);

  const rpc=async(name:string,args:any={})=>{setBusy(true);const {data,error}=await supabase.rpc(name as any,args);setBusy(false);if(error){toast.error(mapError(error));return null;}await onRefresh();return data as RpcResult;};
  const act=async(action:"fold"|"check"|"call"|"raise"|"allin",amount=0)=>{if(!myTurn||busy)return;await rpc("poker_action",{_tournament_id:tournament.id,_action:action,_amount:amount});};
  const deal=async()=>{if(busy)return;await rpc("poker_start_hand",{_tournament_id:tournament.id});};
  const cashOut=async()=>{const res=await rpc("poker_cash_out",{_tournament_id:tournament.id});if(res){toast.success(`Vyplaceno $${Number((res as unknown as { cashed?: number }).cashed??0).toFixed(2)}.`);await refreshProfile();onBack();}};

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/80 p-4"><div><span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">BUY-IN ${Number(tournament.buy_in).toFixed(0)}</span><h2 className="font-display text-2xl font-bold text-white">{tournament.name}</h2></div><div className="flex flex-wrap gap-2"><button onClick={onBack} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-zinc-300">LOBBY</button>{tournament.created_by===user?.id&&<button onClick={onCancel} disabled={busy||!!(hand&&hand.stage!=='done')} className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 font-mono text-xs font-bold text-red-400 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5"/> ZRUŠIT</button>}{tournament.status==='finished'&&mySeat&&<button onClick={()=>void cashOut()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-xs font-bold text-amber-400"><LogOut className="h-3.5 w-3.5"/> CASH OUT</button>}{(!hand||hand.stage==='done')&&tournament.status!=='finished'&&mySeat&&<button onClick={()=>void deal()} disabled={busy||seats.filter(s=>s.chips>0).length<2} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 font-mono text-xs font-black text-black disabled:opacity-40"><Play className="h-3.5 w-3.5"/> ROZDAT</button>}<button onClick={()=>void onRefresh()} className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400"><RefreshCw className={cn("h-4 w-4",busy&&"animate-spin")}/></button></div></div>

    <div className="relative overflow-hidden rounded-[2.5rem] border-4 border-amber-950/60 bg-emerald-950 p-5 sm:p-9 shadow-[inset_0_0_80px_rgba(0,0,0,.85)] ring-1 ring-amber-500/20"><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,90,55,.45),transparent_60%)]"/><FlyingEmoji items={emojis}/><div className="relative z-10 flex flex-col items-center gap-4"><span className="rounded-full border border-emerald-500/30 bg-emerald-950/80 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-300">{hand?hand.stage.toUpperCase():`ČEKÁ NA HRÁČE (${seats.length}/${tournament.max_players})`}</span><div className="flex min-h-24 items-center justify-center gap-2 sm:gap-3">{Array.from({length:5},(_,i)=><HoleCard key={i} card={board[i]} hidden={!board[i]} delay={i*70}/>)}</div><div className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-black/80 px-5 py-2 font-mono text-sm font-black text-amber-400"><Coins className="h-5 w-5"/> POT: <CountUp value={hand?.pot??0}/></div></div>
      <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{seats.map(s=>{const p=hand?.players.find(x=>x.userId===s.user_id);const idx=hand?.players.findIndex(x=>x.userId===s.user_id)??-1;const isTurn=!!hand&&hand.stage!=='done'&&hand.toAct===idx;const mine=s.user_id===user?.id;const winner=hand?.winners?.some(w=>w.userId===s.user_id);const cards=p?.holeCards??[];return <div key={s.id} className={cn("relative overflow-hidden rounded-2xl border p-3 backdrop-blur-md",isTurn?"border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40":winner?"border-emerald-400 bg-emerald-500/10":"border-white/10 bg-black/60",p?.folded&&"opacity-40 grayscale")}><div className="flex items-center justify-between"><span className="font-display text-sm font-bold text-zinc-100">{s.nickname}</span>{isTurn&&<span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-amber-400"><Timer className="h-3 w-3"/>{Math.min(secondsLeft,TURN_SECONDS)}s</span>}</div><div className="mt-1 flex items-center justify-between font-mono text-[11px] text-zinc-400"><span>Chips: <b className="text-amber-400">{p?.chips??s.chips}</b></span>{p&&p.bet>0&&<span className="text-emerald-400">Bet: {p.bet}</span>}{p?.allIn&&<span className="rounded bg-red-500/20 px-1 py-0.5 text-[9px] font-black text-red-400">ALL-IN</span>}</div><div className="mt-3 flex justify-center gap-2">{hand?<><HoleCard card={cards[0]} hidden={!mine&&hand.stage!=='done'}/><HoleCard card={cards[1]} hidden={!mine&&hand.stage!=='done'} delay={100}/></>:<><HoleCard hidden/><HoleCard hidden/></>}</div>{winner&&<div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/20 py-1 text-center font-mono text-[10px] font-black text-emerald-300">🏆 {hand?.winners?.find(w=>w.userId===s.user_id)?.label} · +{hand?.winners?.find(w=>w.userId===s.user_id)?.amount}</div>}</div>})}</div>
    </div>

    {mySeat&&hand&&hand.stage!=='done'&&<div className="rounded-3xl border border-white/10 bg-black/90 p-4"><div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500"><span>{myTurn?`TVŮJ TAH · ${Math.min(secondsLeft,TURN_SECONDS)}s`:"ČEKÁNÍ NA SOUPEŘE"}</span><span>·</span><span>DO CALLU {toCall}</span><span>·</span><span>MIN RAISE {minRaise}</span></div><div className="flex flex-wrap items-center gap-3"><button disabled={!myTurn||busy} onClick={()=>void act("fold")} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 font-mono text-xs font-black uppercase text-red-400 disabled:opacity-30">Fold</button><button disabled={!myTurn||busy||toCall>0} onClick={()=>void act("check")} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 font-mono text-xs font-black uppercase text-white disabled:opacity-30">Check</button><button disabled={!myTurn||busy||toCall===0} onClick={()=>void act("call")} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-black uppercase text-amber-300 disabled:opacity-30">Call {toCall>0?toCall:""}</button><div className="flex min-w-[220px] flex-1 items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-2"><input type="range" min={Math.min(minRaise,maxRaise)} max={Math.max(minRaise,maxRaise)} value={Math.min(raise,maxRaise)} onChange={e=>setRaise(Number(e.target.value))} disabled={!myTurn||busy||!myPlayer?.raiseAllowed} className="flex-1 accent-amber-500"/><span className="w-16 text-right font-mono text-xs font-bold text-amber-400">{Math.min(raise,maxRaise)}</span></div><button disabled={!myTurn||busy||!myPlayer?.raiseAllowed||maxRaise<minRaise} onClick={()=>void act("raise",Math.min(raise,maxRaise))} className="rounded-xl bg-amber-500 px-4 py-2.5 font-mono text-xs font-black uppercase text-black disabled:opacity-30">Raise</button><button disabled={!myTurn||busy} onClick={()=>void act("allin")} className="rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-red-600 px-4 py-2.5 font-mono text-xs font-black uppercase text-white disabled:opacity-30">All-In</button></div></div>}
    {hand&&<div className="max-h-40 overflow-y-auto rounded-2xl border border-white/5 bg-black/60 p-3 font-mono text-[11px] text-zinc-400">{hand.log.slice(-18).map((l,i)=><p key={i} className="border-b border-white/5 py-0.5 last:border-0">{l}</p>)}</div>}
  </div><CasinoChat room={`poker-${tournament.id}`} onEmoji={(_n,emoji)=>{const id=Date.now()+Math.random();setEmojis(p=>[...p,{id,emoji}]);window.setTimeout(()=>setEmojis(p=>p.filter(x=>x.id!==id)),1700)}}/></div>;
}
