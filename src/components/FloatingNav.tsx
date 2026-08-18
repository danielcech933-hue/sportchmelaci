import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { Activity, Home, CalendarDays, Users, Trophy, History as HistoryIcon, UserRound, ShieldCheck, Coins, MessagesSquare, HeartHandshake, MapPin, Beer, Layers, Dices, Spade, PackageOpen, ChevronUp, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { IncomingCallPrompt } from "@/components/IncomingCallPrompt";

export type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; exact?: boolean; admin?: boolean; authOnly?: boolean; privilegedOnly?: boolean; boroBlocked?: boolean; fx?: "trophy" };
type NavGroup = { label: string; icon: ComponentType<{ className?: string }>; items: NavItem[] };
type NavEntry = NavItem | NavGroup;

const RESULTS_ITEMS: NavItem[] = [{ to: "/rankings", label: "Scoreboard", icon: Trophy, fx: "trophy" }, { to: "/bets", label: "Sázky", icon: Coins }, { to: "/history", label: "Historie", icon: HistoryIcon }];
const SPORT_ITEMS: NavItem[] = [{ to: "/schedule", label: "Plán", icon: CalendarDays }, { to: "/tournaments", label: "Turnaje", icon: Trophy }, { to: "/teams", label: "Týmy", icon: Users }, { to: "/venues", label: "Sportoviště", icon: MapPin }];
const GAME_ITEMS: NavItem[] = [{ to: "/games/poker", label: "Poker", icon: Spade }, { to: "/games/roulette", label: "Ruleta", icon: Dices }, { to: "/games/ultimate", label: "Ultimate", icon: Layers }, { to: "/slots", label: "Sloty", icon: Beer }, { to: "/games/roll", label: "Roll", icon: Dices, authOnly: true, boroBlocked: true }, { to: "/games/case-opening", label: "Case Opening", icon: PackageOpen, privilegedOnly: true, boroBlocked: true }];
const COMMUNITY_ITEMS: NavItem[] = [{ to: "/chat", label: "Chat", icon: MessagesSquare }, { to: "/support", label: "Podpoř nás", icon: HeartHandshake }, { to: "/profile", label: "Profil", icon: UserRound, authOnly: true }, { to: "/admin", label: "Admin", icon: ShieldCheck, admin: true }];
export const NAV_ITEMS: NavEntry[] = [{ to: "/", label: "Lobby", icon: Home, exact: true }, { to: "/activity", label: "Live Pulse", icon: Activity }, { label: "Sport", icon: Trophy, items: SPORT_ITEMS }, { label: "Výsledky", icon: BarChart3, items: RESULTS_ITEMS }, { label: "Hry", icon: Dices, items: GAME_ITEMS }, { label: "Komunita", icon: Users, items: COMMUNITY_ITEMS }];

const PRIVILEGED_NAMES = new Set(["danko", "chlaďar", "chladar", "midas", "m1das"]);

export function matchesRoute(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

type AuthUser = ReturnType<typeof useAuth>["user"];

function itemIsVisible(item: NavItem, user: AuthUser, isAdmin: boolean, nickname: string | null | undefined) {
  const normalized = (nickname ?? "").trim().toLocaleLowerCase("cs-CZ");
  if (item.boroBlocked && normalized === "boro nezastavitelny") return false;
  if (item.admin) return !!user && isAdmin;
  if (item.authOnly && !user) return false;
  if (item.privilegedOnly && !PRIVILEGED_NAMES.has(normalized)) return false;
  return true;
}

function entryIsVisible(entry: NavEntry, user: AuthUser, isAdmin: boolean, nickname: string | null | undefined) {
  return "items" in entry ? entry.items.some((i) => itemIsVisible(i, user, isAdmin, nickname)) : itemIsVisible(entry, user, isAdmin, nickname);
}

function groupIsActive(pathname: string, group: NavGroup) {
  return group.items.some((i) => matchesRoute(pathname, i));
}

const CHIP = "nav-chip group relative flex min-w-[3.6rem] shrink-0 touch-manipulation flex-col items-center gap-1 rounded-xl px-2.5 py-2 transition sm:min-w-[4.1rem]";

export function FloatingNav() {
  const { user, nickname, isAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  if (loading) return null;

  const visible = NAV_ITEMS.filter((e) => entryIsVisible(e, user, isAdmin, nickname));
  const activeGroup = visible.find((e) => "items" in e && e.label === openGroup) as NavGroup | undefined;

  return (
    <>
      {user && <IncomingCallPrompt />}

      {activeGroup && (
        <>
          <button type="button" aria-label="Zavřít nabídku" onClick={() => setOpenGroup(null)} className="fixed inset-0 z-[9998] bg-background/70 backdrop-blur-sm" />
          <div role="menu" aria-label={activeGroup.label} className="pointer-events-none fixed inset-x-0 bottom-[5.4rem] z-[10000] flex justify-center px-3 sm:bottom-[6rem]">
            <div className="pointer-events-auto aaa-surface aaa-hairline-top w-full max-w-md p-2 backdrop-blur-xl">
              <p className="aaa-meta px-2 pb-2 pt-1">{activeGroup.label}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {activeGroup.items.filter((item) => itemIsVisible(item, user, isAdmin, nickname)).map((item) => {
                  const ItemIcon = item.icon;
                  const itemActive = matchesRoute(pathname, item);
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setOpenGroup(null)} role="menuitem" className={`flex min-h-12 items-center gap-2.5 rounded-[var(--aaa-radius-sm)] border px-3 py-2 text-xs font-semibold transition ${itemActive ? "border-primary/45 bg-primary/12 text-primary" : "border-border/50 bg-surface/50 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/35 hover:text-foreground"}`}>
                      <ItemIcon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <nav aria-label="Hlavní navigace" className="pointer-events-none fixed inset-x-0 bottom-3 z-[9999] flex justify-center px-2 pb-[env(safe-area-inset-bottom)] sm:bottom-5">
        <div className="nav-dock pointer-events-auto relative isolate flex max-w-[min(78rem,97vw)] items-center gap-1 overflow-x-auto rounded-[1.35rem] px-1.5 py-1.5 sm:gap-1.5 sm:px-2 md:overflow-visible">
          <span aria-hidden className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent opacity-80" />
          {visible.map((entry) => {
            if ("items" in entry) {
              const Icon = entry.icon;
              const active = groupIsActive(pathname, entry);
              const open = openGroup === entry.label;
              return (
                <button key={entry.label} type="button" onClick={() => setOpenGroup((c) => (c === entry.label ? null : entry.label))} aria-expanded={open} aria-haspopup="menu" title={entry.label} className={`${CHIP} ${active || open ? "nav-chip-active text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  <span className="relative inline-flex h-4 items-center justify-center">
                    <Icon className={`h-4 w-4 ${active || open ? "scale-110" : ""}`} />
                    {(active || open) && <span className="absolute -bottom-1.5 h-0.5 w-3 rounded-full bg-primary" />}
                  </span>
                  <span className="flex items-center gap-0.5 whitespace-nowrap font-mono text-[8px] font-semibold uppercase tracking-[0.14em] sm:text-[9px]">
                    {entry.label}
                    <ChevronUp className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
                  </span>
                </button>
              );
            }

            const active = matchesRoute(pathname, entry);
            const Icon = entry.icon;
            return (
              <Link key={entry.to} to={entry.to} activeOptions={entry.exact ? { exact: true } : undefined} aria-current={active ? "page" : undefined} title={entry.label} onClick={() => setOpenGroup(null)} className={`${CHIP} ${active ? "nav-chip-active text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <span className="relative inline-flex h-4 items-center justify-center">
                  <Icon className={`h-4 w-4 ${active ? "scale-110" : ""}`} />
                  {active && <span className="absolute -bottom-1.5 h-0.5 w-3 rounded-full bg-primary" />}
                </span>
                <span className="whitespace-nowrap font-mono text-[8px] font-semibold uppercase tracking-[0.14em] sm:text-[9px]">{entry.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}