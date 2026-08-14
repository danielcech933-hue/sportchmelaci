import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck, Smartphone, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

function normalizePhone(value: string): string {
  const trimmed = value.trim().replace(/[\s()-]/g, "");
  return trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
}

export function PhoneVerificationGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const verified = Boolean(user?.phone && user?.phone_confirmed_at);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (loading || !user || verified) return <>{children}</>;

  async function sendCode() {
    setError(null);
    setNotice(null);
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("Zadej telefon v mezinárodním formátu, například +420777123456.");
      return;
    }
    if (cooldown > 0) return;
    setBusy("send");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ phone: normalized });
      if (updateError) throw updateError;
      setPhone(normalized);
      setSentTo(normalized);
      setOtp("");
      setCooldown(60);
      setNotice("Odeslali jsme 6místný ověřovací kód SMS.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SMS se nepodařilo odeslat.");
    } finally {
      setBusy(null);
    }
  }

  async function verifyCode() {
    setError(null);
    setNotice(null);
    const normalized = normalizePhone(sentTo ?? phone);
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Zadej 6místný ověřovací kód.");
      return;
    }
    setBusy("verify");
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalized,
        token: otp.trim(),
        type: "phone_change",
      });
      if (verifyError) throw verifyError;
      await supabase.auth.getUser();
      setNotice("Telefon je ověřený. Pokračujeme…");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ověření kódu selhalo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="relative mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
        <section className="w-full overflow-hidden rounded-3xl border border-primary/30 bg-background/90 p-6 shadow-[0_0_80px_-24px_var(--color-primary)] backdrop-blur sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3 text-primary"><Smartphone className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">SportChmeláci · Bezpečnostní brána</p>
              <h1 className="mt-1 font-display text-3xl uppercase tracking-[0.08em] text-primary">Ověř telefon</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Abychom ti mohli posílat důležitá upozornění na tvoje zápasy, musíš přidat telefonní číslo a potvrdit, že ho opravdu vlastníš.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
            <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>Číslo nebude veřejně zobrazené. Používáme ho pro ověření účtu a volitelná upozornění na zápasy.</p></div>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Telefon</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy !== null || !!sentTo} placeholder="+420 777 123 456" className="rounded-xl border border-border bg-background/60 px-3 py-3 outline-none focus:border-primary disabled:opacity-60" inputMode="tel" autoComplete="tel" />
            </label>
            <button type="button" onClick={() => void sendCode()} disabled={busy !== null || cooldown > 0 || !!sentTo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy === "send" ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {cooldown > 0 ? `Poslat znovu za ${cooldown}s` : "Poslat ověřovací SMS"}
            </button>

            {sentTo && (
              <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Kód odeslán na {sentTo}</p>
                <div className="mt-3 flex gap-2">
                  <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 py-3 font-mono text-center text-lg tracking-[0.5em] outline-none focus:border-primary" />
                  <button type="button" onClick={() => void verifyCode()} disabled={busy !== null || otp.length !== 6} className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background disabled:opacity-50">{busy === "verify" ? "Ověřuji…" : "Ověřit"}</button>
                </div>
                <button type="button" onClick={() => { setSentTo(null); setOtp(""); setNotice(null); setError(null); }} className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">Změnit číslo</button>
              </div>
            )}
          </div>

          {error && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
          {notice && <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-accent">{notice}</div>}

          <div className="mt-6 flex justify-center">
            <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" /> Odhlásit se</button>
          </div>
        </section>
      </div>
    </div>
  );
}
