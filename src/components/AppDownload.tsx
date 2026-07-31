import { useEffect, useState } from "react";
import { Apple, Smartphone, Share, Plus, Check, Download } from "lucide-react";

const APP_STORE_URL = "https://apps.apple.com/cz/search?term=Chmelov%C3%AD%20Sportovci";


type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function useInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && "ontouchend" in document));
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari
        (window.navigator as unknown as { standalone?: boolean }).standalone === true,
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
    return outcome === "accepted";
  };

  return { canInstall: !!deferred, installed, isIOS, install };
}

function InstallButton({
  icon,
  top,
  bottom,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  top: string;
  bottom: string;
  onClick?: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!active}
      className={`flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-primary/35 bg-surface/70 px-4 py-3 text-left transition active:scale-[0.98] ${
        active ? "hover:border-primary/70 hover:bg-primary/10" : "opacity-70"
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {top}
        </span>
        <span className="block truncate font-display text-lg leading-tight tracking-wider">{bottom}</span>
      </span>
    </button>
  );
}

export function AppDownload() {
  const { canInstall, installed, isIOS, install } = useInstallPrompt();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setStandalone(
        mq.matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true,
      );
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Already installed & launched as an app — no need for instructions.
  if (standalone) return null;

  return (
    <section
      id="download"
      className="panel neon-border mx-auto mt-10 max-w-6xl scroll-mt-24 p-4 sm:p-6"
      aria-labelledby="download-heading"
    >
      <h2 id="download-heading" className="font-display text-2xl tracking-wider neon-text sm:text-3xl">
        Stáhni si appku
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Chmeloví Sportovci v mobilu — live skóre, sázky a notifikace na turnaje. Instaluje se přímo
        z prohlížeče, žádný obchod není potřeba.
      </p>

      {installed ? (
        <div className="mt-4 flex min-h-12 items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary">
            <Check className="h-5 w-5" />
          </span>
          <span className="font-display text-lg tracking-wider">Appka je nainstalovaná 🎉</span>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <InstallButton
            icon={canInstall ? <Download className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
            top={canInstall ? "Instalace z prohlížeče" : "Menu prohlížeče → Instalovat"}
            bottom="Nainstalovat na Android"
            onClick={install}
            active={canInstall}
          />
          <InstallButton
            icon={<Apple className="h-5 w-5" />}
            top="Safari → Sdílet → Na plochu"
            bottom="Nainstalovat na iOS"
            active={false}
          />
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-[0.25em] text-primary/80">
            {isIOS ? "iPhone / iPad — krok za krokem" : "iOS — krok za krokem"}
          </span>
          <ol className="mt-2 space-y-2">
            {[
              <>Otevři <strong className="text-foreground">sportchmelaci.lovable.app</strong> v prohlížeči <strong className="text-foreground">Safari</strong> (Chrome na iOS instalaci neumí).</>,
              <>Klepni dole na ikonu <Share className="inline h-3.5 w-3.5 text-primary" /> <strong className="text-foreground">Sdílet</strong>.</>,
              <>Sroluj dolů a zvol <Plus className="inline h-3.5 w-3.5 text-primary" /> <strong className="text-foreground">„Přidat na plochu“</strong>.</>,
              <>Potvrď <strong className="text-foreground">Přidat</strong> — ikona <strong className="text-foreground">Chmeloví Sportovci</strong> se objeví na ploše a appka se spustí na celou obrazovku.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary/20 font-mono text-[10px] text-primary">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-11 items-center gap-3 rounded-lg border border-primary/35 bg-surface/70 px-3 py-2 transition hover:border-primary/70 hover:bg-primary/10"
          >
            <Apple className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Hledat na App Store
              </span>
              <span className="block truncate font-display text-base leading-tight tracking-wider text-foreground">
                Chmeloví Sportovci
              </span>
            </span>
          </a>
          <p className="mt-2 text-[11px] opacity-80">
            Nativní verze v App Store se připravuje — do té doby použij instalaci na plochu výše.
          </p>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-[0.25em] text-primary/80">Android — krok za krokem</span>
          <ol className="mt-2 space-y-2">
            {[
              <>Otevři web v <strong className="text-foreground">Chrome</strong>.</>,
              <>Klepni na tlačítko <strong className="text-foreground">Nainstalovat na Android</strong> výše, nebo na ⋮ menu prohlížeče.</>,
              <>Zvol <strong className="text-foreground">„Instalovat aplikaci“</strong> / „Přidat na plochu“ a potvrď.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary/20 font-mono text-[10px] text-primary">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

    </section>
  );
}
