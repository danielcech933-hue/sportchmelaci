import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import {
  Home,
  CalendarDays,
  Users,
  Trophy,
  History as HistoryIcon,
  UserRound,
  ShieldCheck,
  Coins,
  MessagesSquare,
  HeartHandshake,
  MapPin,
  Beer,
  Layers,
  Dices,
  Spade,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { IncomingCallPrompt } from "@/components/IncomingCallPrompt";

export type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  admin?: boolean;
  authOnly?: boolean;
  fx?: "trophy";
};

type NavGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: NavItem[];
};

type NavEntry = NavItem | NavGroup;

const RESULTS_ITEMS: NavItem[] = [
  { to: "/rankings", label: "Scoreboard", icon: Trophy, fx: "trophy" },
  { to: "/bets", label: "Sázky", icon: Coins },
  { to: "/history", label: "Historie", icon: HistoryIcon },
];

const GAME_ITEMS: NavItem[] = [
  { to: "/games/poker", label: "Poker", icon: Spade },
  { to: "/games/roulette", label: "Ruleta", icon: Dices },
  { to: "/games/ultimate", label: "Ultimate", icon: Layers },
  { to: "/slots", label: "Sloty", icon: Beer },
];

export const NAV_ITEMS: NavEntry[] = [
  { to: "/", label: "Lobby", icon: Home, exact: true },
  { to: "/schedule", label: "Plán", icon: CalendarDays },
  { to: "/tournaments", label: "Turnaje", icon: Trophy },
  { label: "Výsledky", icon: BarChart3, items: RESULTS_ITEMS },
  { label: "Hry", icon: Dices, items: GAME_ITEMS },
  { to: "/teams", label: "Týmy", icon: Users },
  { to: "/venues", label: "Sportoviště", icon: MapPin },
  { to: "/chat", label: "Chat", icon: MessagesSquare },
  { to: "/support", label: "Podpoř nás", icon: HeartHandshake },
  { to: "/profile", label: "Profil", icon: UserRound, authOnly: true },
  { to: "/admin", label: "Admin", icon: ShieldCheck, admin: true },
];

export function matchesRoute(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

function entryIsVisible(entry: NavEntry, user: ReturnType<typeof useAuth>["user"], isAdmin: boolean) {
  if ("items" in entry) {
    return entry.items.some((item) => {
      if (item.admin) return !!user && isAdmin;
      if (item.authOnly) return !!user;
      return true;
    });
  }
  if (entry.admin) return !!user && isAdmin;
  if (entry.authOnly) return !!user;
  return true;
}

function groupIsActive(pathname: string, group: NavGroup) {
  return group.items.some((item) => matchesRoute(pathname, item));
}

export function FloatingNav() {
  const { user, isAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hidden, setHidden] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - last;
        if (Math.abs(delta) < 6) return;
        if (delta > 0 && y > 120) setHidden(true);
        else if (delta < 0) setHidden(false);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    setHidden(false);
    setOpenGroup(null);
  }, [pathname]);

  if (loading) return null;

  const visible = NAV_ITEMS.filter((entry) => entryIsVisible(entry, user, isAdmin));

  return (
    <>
      {user && <IncomingCallPrompt />}
      <nav
        aria-label="Hlavní navigace"
        className={`fixed inset-x-0 bottom-3 z-50 flex justify-center px-2 transition-[transform,opacity] duration-300 ease-out will-change-transform sm:bottom-5 ${
          hidden ? "translate-y-[150%] opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div
          onWheel={(e) => {
            const el = e.currentTarget;
            if (el.scrollWidth <= el.clientWidth) return;
            el.scrollLeft += e.deltaY + e.deltaX;
          }}
          className="nav-dock relative flex max-w-[min(78rem,97vw)] items-center gap-1 overflow-x-auto rounded-[1.35rem] px-2 py-2 shadow-2xl sm:gap-1.5 sm:px-3 md:flex-wrap md:justify-center md:gap-1.5 md:overflow-visible"
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent opacity-80" />
          {visible.map((entry) => {
            if ("items" in entry) {
              const Icon = entry.icon;
              const active = groupIsActive(pathname, entry);
              const open = openGroup === entry.label;
              return (
                <div key={entry.label} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenGroup((current) => (current === entry.label ? null : entry.label))}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    title={entry.label}
                    className={`nav-chip group relative flex min-w-[3.8rem] flex-col items-center gap-1 rounded-xl px-2.5 py-2 transition-[transform,color,background,box-shadow] duration-200 sm:min-w-[4.4rem] sm:px-3 ${
                      active || open
                        ? "nav-chip-active text-primary shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--color-primary)_80%,transparent)]"
                        : "text-muted-foreground hover:-translate-y-0.5 hover:text-foreground"
                    }`}
                  >
                    <span className="relative inline-flex h-5 items-center justify-center">
                      <Icon className={`h-[18px] w-[18px] transition-transform duration-200 ${active || open ? "scale-110" : "group-hover:scale-110"}`} />
                      {(active || open) && <span aria-hidden className="absolute -bottom-1 h-0.5 w-4 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />}
                    </span>
                    <span className="flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-[0.11em] sm:text-[9px]">
                      {entry.label}
                      <ChevronUp className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
                    </span>
                  </button>

                  {open && (
                    <div className="absolute bottom-[calc(100%+0.55rem)] left-1/2 min-w-[11rem] -translate-x-1/2 rounded-2xl border border-primary/25 bg-background/95 p-1.5 shadow-2xl backdrop-blur-xl">
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,var(--color-primary)_0%,transparent_55%)] opacity-[0.06]" />
                      <div className="relative grid gap-1">
                        {entry.items.map((item) => {
                          if (item.admin && (!user || !isAdmin)) return null;
                          if (item.authOnly && !user) return null;
                          const ItemIcon = item.icon;
                          const itemActive = matchesRoute(pathname, item);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              activeOptions={item.exact ? { exact: true } : undefined}
                              onClick={() => setOpenGroup(null)}
                              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                                itemActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
                              }`}
                            >
                              <ItemIcon className="h-4 w-4" />
                              <span className="flex-1">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            const active = matchesRoute(pathname, entry);
            const Icon = entry.icon;
            return (
              <Link
                key={entry.to}
                to={entry.to}
                activeOptions={entry.exact ? { exact: true } : undefined}
                aria-current={active ? "page" : undefined}
                title={entry.label}
                className={`nav-chip group relative flex min-w-[3.8rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2.5 py-2 transition-[transform,color,background,box-shadow] duration-200 sm:min-w-[4.4rem] sm:px-3 ${
                  active
                    ? "nav-chip-active text-primary shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--color-primary)_80%,transparent)]"
                    : "text-muted-foreground hover:-translate-y-0.5 hover:text-foreground"
                }`}
              >
                <span className="relative inline-flex h-5 items-center justify-center">
                  <Icon className={`h-[18px] w-[18px] transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"} ${entry.fx === "trophy" ? "group-hover:trophy-pop" : ""}`} />
                  {active && <span aria-hidden className="absolute -bottom-1 h-0.5 w-4 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />}
                  {entry.fx === "trophy" && (
                    <span aria-hidden className="pointer-events-none absolute -inset-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      {Array.from({ length: 6 }).map((_, i) => <span key={i} className={`spark spark-${i}`} />)}
                    </span>
                  )}
                </span>
                <span className="text-[8px] font-semibold uppercase tracking-[0.11em] sm:text-[9px]">{entry.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
