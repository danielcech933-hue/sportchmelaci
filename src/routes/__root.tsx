import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, useRouterState, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { UserRound, Radio, WalletCards } from "lucide-react";

import appCss from "../styles.css?url";
import visualCss from "../visual-polish.css?url";
import chmDesignCss from "../chmel-design-system.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Avatar } from "@/lib/avatars";
import { NotificationsBell } from "@/lib/notifications";
import { DmProvider, DmBell } from "@/lib/dm";
import { SiteFooter } from "@/components/SiteFooter";
import { FloatingNav, DesktopNav } from "@/components/FloatingNav";
import { CommandPalette } from "@/components/CommandPalette";
import { WinCelebrations } from "@/lib/win-toasts";
import { WalletProvider, useWallet } from "@/lib/wallet";
import { Toaster } from "@/components/ui/sonner";
import { StadiumBackdrop } from "@/components/StadiumBackdrop";
import { CallPushRegistrar } from "@/components/CallPushRegistrar";
import { NativeCallSessionHost } from "@/components/NativeCallSessionHost";
import { motion } from "framer-motion";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="aaa-surface max-w-md rounded-[28px] p-8 text-center">
        <div className="aaa-meta text-amber-200/70">CHMELOVÍ SPORTOVCI · 404</div>
        <h1 className="mt-2 text-7xl font-display text-primary">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tahle stránka není na výsledkové tabuli.</p>
        <Link to="/" className="aaa-cta mt-6 inline-flex items-center justify-center px-4 py-2 text-sm font-semibold">Zpět do lobby</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="aaa-surface max-w-md rounded-[28px] p-8 text-center">
        <div className="aaa-meta text-rose-200/70">SYSTÉM · PŘERUŠENO</div>
        <h1 className="mt-2 text-xl font-display text-foreground">Hra byla přerušena</h1>
        <p className="mt-2 text-sm text-muted-foreground">Něco se pokazilo. Zkus stránku načíst znovu.</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="aaa-cta mt-6 inline-flex items-center justify-center px-4 py-2 text-sm font-semibold">Zkusit znovu</button>
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
      { title: "Chmeloví Sportovci — sportovní lobby" },
      { name: "description", content: "Sportovní scoreboard, turnaje, sázky, chat a herní lobby Chmelových Sportovců." },
      { property: "og:title", content: "Chmeloví Sportovci — sportovní lobby" },
      { property: "og:description", content: "Sportovní scoreboard, turnaje, sázky, chat a herní lobby Chmelových Sportovců." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Chmeloví Sportovci — sportovní lobby" },
      { name: "twitter:description", content: "Sportovní scoreboard, turnaje, sázky, chat a herní lobby Chmelových Sportovců." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/b40a6d80-361c-4f14-9e51-dc3d592157f2" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/b40a6d80-361c-4f14-9e51-dc3d592157f2" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: visualCss },
      { rel: "stylesheet", href: chmDesignCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return <html lang="cs"><head><HeadContent /></head><body className="chm-app-shell">{children}<Scripts /></body></html>;
}

function PageTransition() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: "easeOut" }}>
      <Outlet />
    </motion.div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WalletProvider>
          <DmProvider>
            <div className="flex min-h-screen flex-col">
              <StadiumBackdrop />
              <SiteHeader />
              <div className="flex-1"><PageTransition /></div>
              <SiteFooter />
              <FloatingNav />
              <WinCelebrations />
              <CallPushRegistrar />
              <NativeCallSessionHost />
              <Toaster />
            </div>
          </DmProvider>
        </WalletProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function SiteHeader() {
  const { user, nickname, avatarPath, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = pathname.startsWith("/match")
    ? { label: "Živý zápas", icon: Radio }
    : pathname.startsWith("/auth")
      ? { label: "Přihlášení", icon: UserRound }
      : null;

  return (
    <header className="chm-site-header sticky top-0 z-40 border-b border-primary/20 bg-background/80 shadow-[0_10px_50px_-36px_rgba(250,204,21,.65)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/58">
      <div className="absolute inset-0 grid-bg opacity-[0.06] pointer-events-none" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
      <div className="relative mx-auto max-w-[1500px] px-2.5 py-2 sm:px-4 sm:py-2.5">
        <div className="flex min-h-10 items-center gap-2 sm:min-h-11">
          <Link to="/" aria-label="Chmeloví Sportovci — Lobby" className="group flex min-w-0 flex-1 items-center gap-2.5 md:flex-none">
            <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/35 bg-primary/10 shadow-[0_0_28px_-10px_var(--color-primary)] transition duration-300 group-hover:border-primary/60 group-hover:shadow-[0_0_32px_-8px_var(--color-primary)] sm:h-9 sm:w-9">
              <span aria-hidden className="sport-cycle text-sm leading-none sm:text-base"><span>⚽</span><span>🎾</span><span>🏐</span><span>🏓</span></span>
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
            </span>
            <span className="brand-shimmer hidden truncate font-display text-xl tracking-[0.08em] neon-text sm:block md:text-2xl md:tracking-[0.18em]">CHMELOVÍ SPORTOVCI</span>
            <span className="brand-shimmer truncate font-display text-lg tracking-[0.07em] neon-text sm:hidden">CHM SPORT</span>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex"><DesktopNav /></div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <div className="hidden items-center gap-1.5 rounded-xl border border-emerald-300/15 bg-emerald-300/[.035] px-2.5 py-1.5 md:flex" aria-label="Systém je online">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,.7)]" />
              <span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-emerald-200/75">ONLINE</span>
            </div>
            <CommandPalette />
            {current && (
              <div className="hidden shrink-0 items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-2.5 py-1.5 md:flex">
                <current.icon className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-primary/90">{current.label}</span>
              </div>
            )}
            <DmBell />
            <NotificationsBell />
            <AuthNav user={user} nickname={nickname} avatarPath={avatarPath} loading={loading} />
          </div>
        </div>
      </div>
    </header>
  );
}

function AuthNav({ user, nickname, avatarPath, loading }: { user: ReturnType<typeof useAuth>["user"]; nickname: string | null; avatarPath: string | null; loading: boolean }) {
  const { signOut } = useAuth();
  const { userDollars } = useWallet();
  if (loading) return null;
  if (!user) return <Link to="/auth" className="rounded-xl border border-primary/50 bg-primary px-3 py-1.5 text-[11px] font-black text-primary-foreground shadow-[0_0_24px_-10px_var(--color-primary)] transition hover:-translate-y-0.5 hover:bg-primary/90">Přihlásit</Link>;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Link to="/profile" aria-label="Profil" className="shrink-0 rounded-full ring-1 ring-primary/25 shadow-[0_0_20px_-12px_var(--color-primary)] transition hover:ring-primary/60">
        <Avatar path={avatarPath} nickname={nickname} size={32} zoomable={false} />
      </Link>
      <Link to="/profile" aria-label="Peněženka" className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-accent/35 bg-accent/10 px-1.5 py-1.5 font-mono text-[10px] font-black leading-none text-accent transition hover:-translate-y-0.5 hover:border-accent/70 sm:px-2">
        <WalletCards className="h-3 w-3" />${userDollars.toFixed(0)}
      </Link>
      {nickname && <span className="hidden max-w-28 truncate font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground lg:inline">{nickname}</span>}
      <button onClick={() => signOut()} aria-label="Odhlásit" title="Odhlásit" className="rounded-xl border border-primary/20 px-1.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/55 hover:bg-primary/5 hover:text-foreground">
        <span aria-hidden>⎋</span>
      </button>
    </div>
  );
}
