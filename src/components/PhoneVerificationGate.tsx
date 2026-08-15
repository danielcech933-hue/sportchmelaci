import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ShieldCheck, Send, LogOut, RefreshCw, ExternalLink } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getTelegramStatus, startTelegramLink } from "@/lib/telegram.functions";
import { useAuth } from "@/lib/auth";

export function PhoneVerificationGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const fetchStatus = useServerFn(getTelegramStatus);
  const startLink = useServerFn(startTelegramLink);

  const [checked, setChecked] = useState(false);
  const [verified, setVerified] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await fetchStatus();
      setVerified(status.verified);
      setConfigured(status.configured);
      setBotUsername(status.botUsername);
    } catch {
      // Never lock everyone out because of a transient status read failure.
      setVerified(true);
    } finally {
      setChecked(true);
    }
  }, [fetchStatus]);

  useEffect(() => {
    if (loading || !user) return;
    void refresh();
  }, [loading, user, refresh]);

  // Poll while waiting for the Telegram contact share.
  useEffect(() => {
    if (!deepLink || verified) return;
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [deepLink, verified, refresh]);

  if (loading || !user) return <>{children}</>;
  if (!checked) return <>{children}</>;
  if (verified || !configured) return <>{children}</>;

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await startLink();
      if (!res.ok) {
        setError(
          res.reason === "not_configured"
            ? "Telegram bot ještě není nastavený. Ozvi se adminovi."
            : "Odkaz se nepodařilo vytvořit, zkus to znovu.",
        );
        return;
      }
      setDeepLink(res.deepLink);
      setBotUsername(res.botUsername);
      window.open(res.deepLink, "_blank", "noopener,noreferrer");
    } catch {
      setError("Odkaz se nepodařilo vytvořit, zkus to znovu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="relative mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
        <section className="w-full overflow-hidden rounded-3xl border border-primary/30 bg-background/90 p-6 shadow-[0_0_80px_-24px_var(--color-primary)] backdrop-blur sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3 text-primary"><Send className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">SportChmeláci · Bezpečnostní brána</p>
              <h1 className="mt-1 font-display text-3xl uppercase tracking-[0.08em] text-primary">Propoj Telegram</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Ověření telefonu běží <b>zdarma přes Telegram</b> — <b>žádná SMS</b> a žádná placená brána. V chatu s naším botem
                stačí klepnout na tlačítko „Sdílet moje telefonní číslo“.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>Ukládáme jen bezpečný hash čísla, poslední 4 číslice a tvoje Telegram ID. Číslo nebude nikde veřejně zobrazené.
                Po propojení ti přes Telegram můžeme posílat připomínky zápasů — také zdarma.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => void connect()}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-bold uppercase tracking-wide text-primary-foreground shadow-[0_0_40px_-12px_var(--color-primary)] disabled:opacity-50"
            >
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
              Ověřit zdarma přes Telegram
            </button>

            {deepLink && (
              <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                  Krok 2 · v Telegramu klepni na „Sdílet moje telefonní číslo“
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Odkaz je jednorázový a platí 15 minut{botUsername ? ` (bot @${botUsername})` : ""}. Po potvrzení se tato stránka
                  odemkne sama.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 px-3 py-2 text-xs font-semibold text-accent"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Otevřít Telegram
                  </a>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Zkontrolovat stav
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

          <div className="mt-6 flex justify-center">
            <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> Odhlásit se
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
