import { useEffect, useState } from "react";
import { Apple, Smartphone, Share, Plus, Check, Download } from "lucide-react";

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

      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <span className="font-mono uppercase tracking-[0.25em] text-primary/80">
          {isIOS ? "Návod pro iPhone" : "Návod"}
        </span>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          Přidej si web na plochu: v prohlížeči zvol
          <Share className="inline h-3.5 w-3.5 text-primary" /> Sdílet →
          <Plus className="inline h-3.5 w-3.5 text-primary" /> „Přidat na plochu“. Funguje na iOS i Androidu
          a chová se to jako nativní appka.
        </p>
      </div>
    </section>
  );
}
