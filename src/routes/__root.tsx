import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth";

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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
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
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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
        <div className="min-h-screen">
          <header className="border-b border-border/60">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link to="/" className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-primary shadow-[0_0_12px] shadow-primary" />
                <span className="font-display text-2xl tracking-widest">COURTSIDE</span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link to="/" activeOptions={{ exact: true }} className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground [&.active]:text-foreground">Lobby</Link>
                <Link to="/schedule" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground [&.active]:text-foreground">Schedule</Link>
                <Link to="/teams" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground [&.active]:text-foreground">Teams</Link>
                <Link to="/rankings" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground [&.active]:text-foreground">Scoreboard 🏆</Link>
                <Link to="/history" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground [&.active]:text-foreground">History</Link>
                <ProfileNavLink />
                <AuthNav />
              </nav>
            </div>
          </header>
          <Outlet />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthNav() {
  const { user, nickname, signOut, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <Link to="/auth" className="ml-2 rounded-md bg-primary px-3 py-2 text-primary-foreground">Sign in</Link>
    );
  }
  return (
    <div className="ml-2 flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {nickname ? <>as <span className="text-primary">{nickname}</span></> : null}
      </span>
      <button onClick={() => signOut()} className="rounded-md border border-border px-3 py-2 text-muted-foreground hover:text-foreground">
        Sign out
      </button>
    </div>
  );
}

function ProfileNavLink() {
  const { user, isAdmin, loading } = useAuth();
  if (loading || !user) return null;
  return (
    <>
      <Link to="/profile" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground [&.active]:text-foreground">Profile</Link>
      {isAdmin && (
        <Link to="/admin" className="rounded-md px-3 py-2 text-accent hover:text-foreground [&.active]:text-foreground">Admin</Link>
      )}
    </>
  );
}
