import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Activity, Home, CalendarDays, Users, Trophy, History as HistoryIcon, UserRound, ShieldCheck, Coins, MessagesSquare, HeartHandshake, MapPin, ChevronUp, ChevronDown, BarChart3, MoreHorizontal } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { IncomingCallPrompt } from "@/components/IncomingCallPrompt";

export type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; exact?: boolean; admin?: boolean; authOnly?: boolean; privilegedOnly?: boolean; boroBlocked?: boolean; fx?: "trophy" };
type NavGroup = { label: string; icon: ComponentType<{ className?: string }>; items: NavItem[] };
type NavEntry = NavItem | NavGroup;

const RESULTS_ITEMS: NavItem[] = [{ to: "/rankings", label: "Scoreboard", icon: Trophy, fx: "trophy" }, { to: "/bets", label: "Sázky", icon: Coins }, { to: "/history", label: "Historie", icon: HistoryIcon }];
const SPORT_ITEMS: NavItem[] = [{ to: "/schedule", label: "Plán", icon: CalendarDays }, { to: "/tournaments", label: "Turnaje", icon: Trophy }, { to: "/teams", label: "Týmy", icon: Users }, { to: "/venues", label: "Sportoviště", icon: MapPin }];
const COMMUNITY_ITEMS: NavItem[] = [{ to: "/community", label: "Hráči", icon: Users }, { to: "/chat", label: "Chat", icon: MessagesSquare }, { to: "/support", label: "Podpoř nás", icon: HeartHandshake }, { to: "/profile", label: "Profil", icon: UserRound, authOnly: true }, { to: "/admin", label: "Admin", icon: ShieldCheck, admin: true }];

export const NAV_ITEMS: NavEntry[] = [
  { to: "/", label: "Lobby", icon: Home, exact: true },
  { to: "/activity", label: "Live Pulse", icon: Activity },
  { label: "Sport", icon: Trophy, items: SPORT_ITEMS },
  { label: "Výsledky", icon: BarChart3, items: RESULTS_ITEMS },
  { label: "Komunita", icon: Users, items: COMMUNITY_ITEMS },
];

const MOBILE_PRIMARY: NavItem[] = [
  { to: "/", label: "Lobby", icon: Home, exact: true },
  { to: "/schedule", label: "Zápasy", icon: CalendarDays },
  { to: "/bets", label: "Sázky", icon: Coins },
  { to: "/chat", label: "Chat", icon: MessagesSquare },
  { to: "/profile", label: "Profil", icon: UserRound, authOnly: true },
];

const MOBILE_MORE: NavGroup = {
  label: "Více",
  icon: MoreHorizontal,
  items: [
    { to: "/activity", label: "Live Pulse", icon: Activity },
    { to: "/rankings", label: "Scoreboard", icon: Trophy },
    { to: "/tournaments", label: "Turnaje", icon: Trophy },
    { to: "/teams", label: "Týmy", icon: Users },
    { to: "/venues", label: "Sportoviště", icon: MapPin },
    { to: "/community", label: "Hráči", icon: Users },
    { to: "/history", label: "Historie", icon: HistoryIcon },
    { to: "/support", label: "Podpoř nás", icon: HeartHandshake },
    { to: "/admin", label: "Admin", icon: ShieldCheck, admin: true },
  ],
};

export function matchesRoute(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

type AuthUser = ReturnType<typeof useAuth>["user"];
type RoleSet = { isAdmin: boolean; hasRole: (role: AppRole) => boolean };

function itemIsVisible(item: NavItem, user: AuthUser, { isAdmin, hasRole }: RoleSet) {
  if (item.boroBlocked && hasRole("restricted")) return false;
  if (item.admin) return !!user && isAdmin;
  if (item.authOnly && !user) return false;
  if (item.privilegedOnly && !(hasRole("case_opener") || isAdmin)) return false;
  return true;
}

function entryIsVisible(entry: NavEntry, user: AuthUser, roleSet: RoleSet) {
  return "items" in entry ? entry.items.some((i) => itemIsVisible(i, user, roleSet)) : itemIsVisible(entry, user, roleSet);
}

function groupIsActive(pathname: string, group: NavGroup) {
  return group.items.some((i) => matchesRoute(pathname, i));
}

const CHIP = "nav-chip group relative flex min-h-[3.1rem] min-w-[3.9rem] flex-1 shrink-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 transition";

export function DesktopNav() {
  const { user, isAdmin, hasRole, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setOpen(null); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (loading) return null;
  const roleSet = { isAdmin, hasRole };
  const visible = NAV_ITEMS.filter((e) => entryIsVisible(e, user, roleSet));

  const linkCls = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-[var(--aaa-radius-sm)] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition ${active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"}`;

  return (
    <nav ref={ref} aria-label="Hlavní navigace (desktop)" className="relative hidden min-w-0 items-center gap-0.5 md:flex">
      {visible.map((entry) => {
        if ("items" in entry) {
          const Icon = entry.icon;
          const active = groupIsActive(pathname, entry);
          const isOpen = open === entry.label;
          return (
            <div key={entry.label} className="relative">
              <button type="button" aria-expanded={isOpen} aria-haspopup="menu" onClick={() => setOpen((c) => (c === entry.label ? null : entry.label))} className={linkCls(active || isOpen)}>
                <Icon className="h-3.5 w-3.5" />
                <span>{entry.label}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div role="menu" aria-label={entry.label} className="aaa-surface absolute left-0 top-[calc(100%+.4rem)] z-50 w-56 p-1.5 backdrop-blur-xl">
                  {entry.items.filter((i) => itemIsVisible(i, user, roleSet)).map((item) => {
                    const ItemIcon = item.icon;
                    const itemActive = matchesRoute(pathname, item);
                    return (
                      <Link key={item.to} to={item.to} role="menuitem" onClick={() => setOpen(null)} className={`flex min-h-10 items-center gap-2.5 rounded-[var(--aaa-radius-sm)] px-2.5 py-2 text-xs font-semibold transition ${itemActive ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"}`}>
                        <ItemIcon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
        const Icon = entry.icon;
        const active = matchesRoute(pathname, entry);
        return (
          <Link key={entry.to} to={entry.to} aria-current={active ? "page" : undefined} className={linkCls(active)}>
            <Icon className="h-3.5 w-3.5" />
            <span>{entry.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function FloatingNav() {
  const { user, isAdmin, hasRole, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  if (loading) return null;

  const roleSet = { isAdmin, hasRole };
  const primary = MOBILE_PRIMARY.filter((i) => itemIsVisible(i, user, roleSet));
  const moreItems = MOBILE_MORE.items.filter((i) => itemIsVisible(i, user, roleSet));
  const moreActive = moreItems.some((i) => matchesRoute(pathname, i));

  return (
    <>
      {user && <IncomingCallPrompt />}

      {moreOpen && (
        <>
          <button type="button" aria-label="Zavřít nabídku" onClick={() => setMoreOpen(false)} className="fixed inset-0 z-[9998] bg-background/70 backdrop-blur-sm md:hidden" />
          <div role="menu" aria-label="Více sekcí" className="pointer-events-none fixed inset-x-0 bottom-[5.6rem] z-[10000] flex justify-center px-3 md:hidden">
            <div className="pointer-events-auto aaa-surface aaa-hairline-top max-h-[60vh] w-full max-w-md overflow-y-auto p-2 backdrop-blur-xl">
              <p className="aaa-meta px-2 pb-2 pt-1">Více sekcí</p>
              <div className="grid grid-cols-2 gap-1.5">
                {moreItems.map((item) => {
                  const ItemIcon = item.icon;
                  const itemActive = matchesRoute(pathname, item);
                  return (
                    <Link key={item.to + item.label} to={item.to} onClick={() => setMoreOpen(false)} role="menuitem" className={`flex min-h-12 items-center gap-2.5 rounded-[var(--aaa-radius-sm)] border px-3 py-2 text-xs font-semibold transition ${itemActive ? "border-primary/45 bg-primary/12 text-primary" : "border-border/50 bg-surface/50 text-muted-foreground hover:border-primary/35 hover:text-foreground"}`}>
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

      <nav aria-label="Hlavní navigace" className="pointer-events-none fixed inset-x-0 bottom-3 z-[9999] flex justify-center px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="nav-dock pointer-events-auto relative isolate flex w-full max-w-[30rem] items-stretch gap-1 rounded-[1.35rem] px-1.5 py-1.5">
          <span aria-hidden className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent opacity-80" />
          {primary.map((entry) => {
            const active = matchesRoute(pathname, entry);
            const Icon = entry.icon;
            return (
              <Link key={entry.to} to={entry.to} activeOptions={entry.exact ? { exact: true } : undefined} aria-current={active ? "page" : undefined} onClick={() => setMoreOpen(false)} className={`${CHIP} ${active ? "nav-chip-active text-primary" : "text-muted-foreground"}`}>
                <Icon className={`h-[1.15rem] w-[1.15rem] ${active ? "scale-110" : ""}`} />
                <span className="whitespace-nowrap font-mono text-[8px] font-semibold uppercase tracking-[0.12em]">{entry.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} aria-haspopup="menu" className={`${CHIP} ${moreActive || moreOpen ? "nav-chip-active text-primary" : "text-muted-foreground"}`}>
            <MoreHorizontal className="h-[1.15rem] w-[1.15rem]" />
            <span className="flex items-center gap-0.5 whitespace-nowrap font-mono text-[8px] font-semibold uppercase tracking-[0.12em]">Více<ChevronUp className={`h-2.5 w-2.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} /></span>
          </button>
        </div>
      </nav>
    </>
  );
}
