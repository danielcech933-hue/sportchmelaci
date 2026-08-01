import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, type ComponentType } from "react";
import {
  Home,
  CalendarDays,
  Users,
  Trophy,
  History as HistoryIcon,
  UserRound,
  ShieldCheck,
  Radio,
  Coins,
  MessagesSquare,
  HeartHandshake,
  MapPin,


} from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Avatar } from "@/lib/avatars";
import { NotificationsBell } from "@/lib/notifications";
import { DmProvider, DmBell } from "@/lib/dm";

import { SiteFooter } from "@/components/SiteFooter";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display text-primary">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page isn't on the scoreboard.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Back to lobby
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-display text-foreground">Match interrupted</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a12" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Chmeloví Sportovci" },
      { name: "format-detection", content: "telephone=no" },
      { title: "Courtside — Pick a Sport" },
      { name: "description", content: "Start a live scoreboard for tennis, volleyball, nohejball, football or padel." },
      { property: "og:title", content: "Courtside — Pick a Sport" },
      { property: "og:description", content: "Start a live scoreboard for tennis, volleyball, nohejball, football or padel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Courtside — Pick a Sport" },
      { name: "twitter:description", content: "Start a live scoreboard for tennis, volleyball, nohejball, football or padel." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/b40a6d80-361c-4f14-9e51-dc3d592157f2" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/b40a6d80-361c-4f14-9e51-dc3d592157f2" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@700;800&display=swap",
      },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DmProvider>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <div className="flex-1">
              <Outlet />
            </div>
            <SiteFooter />
          </div>
        </DmProvider>
      </AuthProvider>
    </QueryClientProvider>

  );
}


type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  exact?: boolean;
  admin?: boolean;
  authOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Lobby", icon: Home, exact: true },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/tournaments", label: "Turnaje", icon: Trophy },
  { to: "/rankings", label: "Scoreboard", icon: Trophy },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/venues", label: "Sportoviště", icon: MapPin },
  { to: "/bets", label: "Bets", icon: Coins },
  { to: "/chat", label: "Chat", icon: MessagesSquare },
  { to: "/history", label: "History", icon: HistoryIcon },
  { to: "/support", label: "Podpoř nás", icon: HeartHandshake },
  { to: "/profile", label: "Profile", icon: UserRound, authOnly: true },
  { to: "/admin", label: "Admin", icon: ShieldCheck, admin: true },
];


function matchesRoute(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

function SiteHeader() {
  const { user, isAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visible = NAV_ITEMS.filter((n) => {
    if (n.admin) return !!user && isAdmin;
    if (n.authOnly) return !!user;
    return true;
  });

  const current =
    visible.find((n) => matchesRoute(pathname, n)) ??
    (pathname.startsWith("/match")
      ? { label: "Live match", icon: Radio, to: "/match", exact: false } as NavItem
      : pathname.startsWith("/auth")
      ? { label: "Sign in", icon: UserRound, to: "/auth", exact: false } as NavItem
      : null);

  return (
    <header className="sticky top-0 z-40 border-b border-primary/25 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
      <div className="relative mx-auto max-w-6xl px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <Link to="/" className="group flex min-w-0 items-center gap-2">
            <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/40 bg-primary/10">
              <span aria-hidden className="sport-cycle text-base leading-none">
                <span>⚽</span>
                <span>🎾</span>
                <span>🏐</span>
                <span>🏓</span>
              </span>
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
            </span>
            <span className="brand-shimmer truncate font-display text-base tracking-wide neon-text sm:text-2xl sm:tracking-widest">
              CHMELOVÍ SPORTOVCI
            </span>
          </Link>

          {current && (
            <div className="hidden min-w-0 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1 md:flex">
              <current.icon className="h-3.5 w-3.5 text-primary" />
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">
                {current.label}
              </span>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1 sm:gap-2"><DmBell /><NotificationsBell /><AuthNav /></div>
        </div>

        {current && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1 md:hidden">
            <current.icon className="h-3.5 w-3.5 text-primary" />
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">
              // {current.label}
            </span>
          </div>
        )}

        {!loading && (
          <nav className="no-scrollbar -mx-3 mt-2 flex snap-x snap-mandatory items-center gap-1 overflow-x-auto px-3 text-sm sm:mx-0 sm:flex-wrap sm:gap-1.5 sm:px-0">
            {visible.map((item) => {
              const active = matchesRoute(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={item.exact ? { exact: true } : undefined}
                  className={`group inline-flex shrink-0 snap-start items-center gap-1.5 rounded-md border px-2.5 py-2 transition active:scale-95 sm:px-3 sm:py-1.5 ${
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_18px_-8px_var(--color-primary)]"
                      : `border-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground ${item.admin ? "text-accent" : ""}`
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-primary" : "opacity-80 group-hover:text-primary"}`} />
                  <span className="text-xs font-medium uppercase tracking-[0.15em] sm:text-[13px]">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}

function AuthNav() {
  const { user, nickname, balance, avatarPath, signOut, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <Link to="/auth" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_0_16px_-4px_hsl(45_100%_60%/0.7)] sm:text-sm">
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      <Link to="/profile" aria-label="Profile" className="shrink-0">
        <Avatar path={avatarPath} nickname={nickname} size={30} zoomable={false} />
      </Link>
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-accent/40 bg-accent/10 px-1.5 py-1 font-mono text-[10px] leading-none text-accent shadow-[0_0_12px_-4px_var(--color-accent)] sm:px-2 sm:text-xs">
        💰 ${balance.toFixed(0)}
      </span>
      {nickname && (
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:inline">
          as <span className="text-primary neon-text">{nickname}</span>
        </span>
      )}
      <button
        onClick={() => signOut()}
        aria-label="Sign out"
        className="shrink-0 rounded-md border border-primary/25 px-2 py-1.5 text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground sm:px-2.5 sm:text-sm"
      >
        <span className="hidden sm:inline">Sign out</span>
        <span className="sm:hidden" aria-hidden>⎋</span>
      </button>
    </div>
  );
}
