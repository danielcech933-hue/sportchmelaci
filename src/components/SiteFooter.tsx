import { Link } from "@tanstack/react-router";
import { AppDownload } from "./AppDownload";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-primary/20 bg-background/60 px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-4">
      <AppDownload />
      <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <span className="font-display text-lg tracking-widest neon-text">CHMELOVÍ SPORTOVCI</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Link to="/rankings" className="hover:text-foreground">Scoreboard</Link>
          <Link to="/tournaments" className="hover:text-foreground">Turnaje</Link>
          <Link to="/venues" className="hover:text-foreground">Sportoviště</Link>
          <Link to="/profile" className="hover:text-foreground">Profil</Link>
          <Link to="/chat" className="hover:text-foreground">Chat</Link>
          <Link to="/support" className="hover:text-foreground">Podpoř nás</Link>
        </nav>
      </div>
    </footer>
  );
}
