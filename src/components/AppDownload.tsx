import { Apple, Smartphone, Share, Plus } from "lucide-react";

const ANDROID_URL = "#";
const IOS_URL = "#";

function StoreBadge({
  href,
  icon,
  top,
  bottom,
}: {
  href: string;
  icon: React.ReactNode;
  top: string;
  bottom: string;
}) {
  const disabled = href === "#";
  return (
    <a
      href={href}
      target={disabled ? undefined : "_blank"}
      rel="noreferrer"
      aria-disabled={disabled}
      onClick={(e) => disabled && e.preventDefault()}
      className={`flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-primary/35 bg-surface/70 px-4 py-3 transition active:scale-[0.98] ${
        disabled ? "opacity-70" : "hover:border-primary/70 hover:bg-primary/10"
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
    </a>
  );
}

export function AppDownload() {
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
        Chmeloví Sportovci v mobilu — live skóre, sázky a notifikace na turnaje.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <StoreBadge
          href={ANDROID_URL}
          icon={<Smartphone className="h-5 w-5" />}
          top="Brzy na Google Play"
          bottom="Stáhnout pro Android"
        />
        <StoreBadge
          href={IOS_URL}
          icon={<Apple className="h-5 w-5" />}
          top="Brzy na App Store"
          bottom="Stáhnout pro iOS"
        />
      </div>

      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <span className="font-mono uppercase tracking-[0.25em] text-primary/80">Bez čekání</span>
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
