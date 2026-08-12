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
  Gamepad2,
  Beer,
  Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  admin?: boolean;
  authOnly?: boolean;
  fx?: "trophy";
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Lobby", icon: Home, exact: true },
  { to: "/schedule", label: "Plán", icon: CalendarDays },
  { to: "/tournaments", label: "Turnaje", icon: Trophy },
  { to: "/rankings", label: "Scoreboard", icon: Trophy, fx: "trophy" },
  { to: "/arcade", label: "Arcade", icon: Gamepad2 },
  { to: "/ultimate-team", label: "Ultimate", icon: Layers },
  { to: "/slots", label: "Sloty", icon: Beer },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/venues", label: "Sportoviště", icon: MapPin },
  { to: "/bets", label: "Bets", icon: Coins },
  { to: "/chat", label: "Chat", icon: MessagesSquare },
  { to: "/history", label: "Historie", icon: HistoryIcon },
  { to: "/support", label: "Podpoř", icon: HeartHandshake },
  { to: "/profile", label: "Profil", icon: UserRound, authOnly: true },
  { to: "/admin", label: "Admin", icon: ShieldCheck, admin: true },
];

export function matchesRoute(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

/** Compact floating navigation dock — smart hide on scroll down, glassmorphism. */
export function FloatingNav() {
  const { user, isAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hidden, setHidden] = useState(false);

  /* Globální scroll listener: dolů = skryj, nahoru = okamžitě zobraz. */
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

  /* Při přechodu na jinou stránku lištu vždy odhal. */
  useEffect(() => setHidden(false), [pathname]);

  if (loading) return null;

  const visible = NAV_ITEMS.filter((n) => {
    if (n.admin) return !!user && isAdmin;
    if (n.authOnly) return !!user;
    return true;
  });

  return (
    <nav
      aria-label="Hlavní navigace"
      className={`fixed inset-x-0 bottom-3 z-50 flex justify-center px-2 transition-transform duration-300 ease-out will-change-transform sm:bottom-5 ${
        hidden ? "translate-y-[150%]" : "translate-y-0"
      }`}
    >
      <div
        onWheel={(e) => {
          // Smooth horizontal mouse-wheel scrolling when the dock overflows.
          const el = e.currentTarget;
          if (el.scrollWidth <= el.clientWidth) return;
          el.scrollLeft += e.deltaY + e.deltaX;
        }}
        className="nav-dock no-scrollbar flex max-w-[min(72rem,96vw)] items-center gap-0.5 overflow-x-auto rounded-2xl border border-primary/25 bg-background/60 px-2 py-1.5 backdrop-blur-xl sm:gap-1 sm:px-3 md:flex-wrap md:justify-center md:gap-1.5 md:overflow-visible"
      >


        {visible.map((item) => {
          const active = matchesRoute(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={item.exact ? { exact: true } : undefined}
              className={`nav-chip group relative flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-all duration-300 sm:px-3 ${
                active ? "nav-chip-active text-primary" : "text-muted-foreground hover:text-primary"
              }`}
            >
              <span className="relative inline-flex">
                <Icon className={`h-[18px] w-[18px] transition-transform duration-300 ${item.fx === "trophy" ? "group-hover:trophy-pop" : "group-hover:scale-125"}`} />
                {item.fx === "trophy" && (
                  <span aria-hidden className="pointer-events-none absolute -inset-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span key={i} className={`spark spark-${i}`} />
                    ))}
                  </span>
                )}
              </span>
              <span className="text-[9px] font-medium uppercase tracking-[0.12em] sm:text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
