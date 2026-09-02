import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, Beer, CalendarDays, Command as CommandIcon, Dices, Gamepad2, History, House, MapPin, PackageOpen, Radio, Search, ShieldCheck, Spade, Trophy, Users, X, Zap } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { useAuth } from "@/lib/auth";

const ITEMS = [
  { to: "/", label: "Domů", group: "Navigace", icon: House, keywords: "domů home dashboard" },
  { to: "/activity", label: "Živé dění", group: "ŽIVĚ", icon: Radio, keywords: "live pulse aktivita stream" },
  { to: "/schedule", label: "Plán zápasů", group: "Sport", icon: CalendarDays, keywords: "schedule fixtures match planner zápasy" },
  { to: "/sport-center", label: "Sport Hub", group: "Sport", icon: Gamepad2, keywords: "sport centrum sporty" },
  { to: "/rankings", label: "Žebříček", group: "Competitive", icon: BarChart3, keywords: "elo ranking žebříček výsledky" },
  { to: "/records", label: "Records / Hall of Fame", group: "Competitive", icon: Trophy, keywords: "rekordy hall fame" },
  { to: "/leagues", label: "Chmel League", group: "Competitive", icon: Trophy, keywords: "liga playoff sezona" },
  { to: "/teams", label: "Team HQ", group: "Community", icon: Users, keywords: "týmy roster 2v2" },
  { to: "/community", label: "Komunita", group: "Community", icon: Users, keywords: "hráči komunita" },
  { to: "/profile", label: "Profil", group: "Identity", icon: ShieldCheck, keywords: "player identity profil" },
  { to: "/trophy-room", label: "Trophy Room", group: "Identity", icon: Trophy, keywords: "odznaky achievementy prestiž" },
  { to: "/my-bets", label: "My Bets / Ticket Center", group: "Betting", icon: Zap, keywords: "sázky tikety payout" },
  { to: "/betting", label: "Betting Hub", group: "Betting", icon: BarChart3, keywords: "betting odds market" },
  { to: "/history", label: "Historie", group: "Competitive", icon: History, keywords: "history zápasy" },
  { to: "/venues", label: "Sportoviště", group: "Sport", icon: MapPin, keywords: "venue location" },
  { to: "/games/poker", label: "Poker", group: "Hry", icon: Spade, keywords: "casino poker" },
  { to: "/games/roulette", label: "Ruleta", group: "Hry", icon: Dices, keywords: "casino roulette" },
  { to: "/slots", label: "Sloty", group: "Hry", icon: Beer, keywords: "slots chmelovci cup" },
  { to: "/games/case-opening", label: "Case Opening", group: "Hry", icon: PackageOpen, keywords: "cases shares akcie roll" },
] as const;

export function CommandPalette() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const visibleItems = useMemo(() => ITEMS.filter((item) => {
    if (item.to === "/games/case-opening" && !user) return false;
    if (item.to === "/profile" && !user) return false;
    if ((item.to as string) === "/admin" && !isAdmin) return false;
    return true;
  }), [isAdmin, user]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(to: string) {
    setOpen(false);
    void navigate({ to });
  }

  const groups = visibleItems.reduce<Record<string, typeof visibleItems[number][]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Otevřít globální vyhledávání"
        title="Hledat — Ctrl/⌘ K"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[.04] px-2 text-muted-foreground transition hover:border-primary/45 hover:text-foreground sm:px-2.5"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden font-mono text-[8px] uppercase tracking-[.16em] sm:inline">Hledat</span>
        <kbd className="hidden rounded border border-white/10 bg-white/[.03] px-1 font-mono text-[8px] text-white/35 sm:inline">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(255,204,68,.12),transparent_35%),linear-gradient(180deg,#0b0f16,#05070b)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
          <CommandInput placeholder="Hledej hráče, sport, zápas, hru…" />
          <CommandList className="max-h-[min(70vh,560px)] p-2">
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <Search className="h-5 w-5 opacity-40" />
                <span>Nic jsem nenašel.</span>
              </div>
            </CommandEmpty>
            <CommandGroup heading="Rychlé akce">
              <CommandItem onSelect={() => go("/activity")} className="min-h-11">
                <Radio />
                <span>Přejít na Live Pulse</span>
                <CommandShortcut>LIVE</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go("/schedule")} className="min-h-11">
                <CalendarDays />
                <span>Otevřít plán zápasů</span>
                <CommandShortcut>PLÁN</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => go("/rankings")} className="min-h-11">
                <BarChart3 />
                <span>Otevřít Scoreboard</span>
                <CommandShortcut>ELO</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator className="my-1" />
            {Object.entries(groups).map(([group, items]) => (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem key={item.to} value={`${item.label} ${item.keywords}`} onSelect={() => go(item.to)} className="min-h-11">
                      <Icon />
                      <span>{item.label}</span>
                      {item.to === "/games/roulette" || item.to === "/games/poker" || item.to === "/slots" ? <CommandShortcut>HRA</CommandShortcut> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="flex items-center justify-between border-t border-white/8 px-3 py-2 font-mono text-[8px] uppercase tracking-[.16em] text-white/30">
            <span className="inline-flex items-center gap-1.5"><CommandIcon className="h-3 w-3" /> Global Command</span>
            <span className="inline-flex items-center gap-1.5"><X className="h-3 w-3" /> Esc</span>
          </div>
        </div>
      </CommandDialog>
    </>
  );
}
