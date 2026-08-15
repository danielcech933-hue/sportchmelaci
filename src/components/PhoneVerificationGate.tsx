import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LogOut, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

function normalizePhone(value: string) {
  const raw = value.trim().replace(/[\s()-]/g, "");
  if (raw.startsWith("00")) return `+${raw.slice(2)}`;
  return raw;
}

function authPhoneError(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("sms") ||
    lower.includes("provider") ||
    lower.includes("phone provider") ||
    lower.includes("phone auth") ||
    lower.includes("twilio")
  ) {
    return "SMS ověření není na Supabase nastavené. Nastav SMS provider (např. Twilio) v Authentication → Providers → Phone.";
  }
  return message;
}

export function PhoneVerificationGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error: getUserError } = await supabase.auth.getUser();
    if (!getUserError && data.user) {
      setPhone(data.user.phone ?? "");
      if (data.user.phone && data.user.phone_confirmed_at) setStep("phone");
    }
    setChecked(true);
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    setPhone(user.phone ?? "");
    void refresh();
  }, [loading, user, refresh]);

  if (loading || !user) return <>{children}</>;
  if (!checked) return <>{children}</>;
  if (user.phone && user.phone_confirmed_at) return <>{children}</>;

  const sendOtp = async () => {
    setError(null);
    setNotice(null);
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("Zadej telefon v mezinárodním formátu, například +420731179919.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ phone: normalized });
      if (updateError) throw updateError;
      setPhone(normalized);
      setOtp("");
      setStep("otp");
      setNotice("Ověřovací SMS byla vyžádána. Zadej 6místný kód ze zprávy.");
    } catch (e) {
      setError(authPhoneError(e instanceof Error ? e.message : "Odeslání SMS selhalo."));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setNotice(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Zadej přesně 6 číslic z SMS.");
      return;
    }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phone),
        token: otp.trim(),
        type: "phone_change",
      });
      if (verifyError) throw verifyError;
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getUser();
      if (!data.user?.phone_confirmed_at) {
        throw new Error("Telefon se nepodařilo označit jako ověřený.");
      }
      setNotice("Telefon je ověřený. Pokračujeme do SportChmeláci.");
      setChecked(true);
    } catch (e) {
      setError(authPhoneError(e instanceof Error ? e.message : "Ověření SMS selhalo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="relative mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
        <section className="w-full overflow-hidden rounded-3xl border border-primary/30 bg-background/95 p-6 shadow-[0_0_80px_-24px_var(--color-primary)] backdrop-blur sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3 text-primary"><Phone className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">SportChmeláci · Bezpečnostní brána</p>
              <h1 className="mt-1 font-display text-3xl uppercase tracking-[0.08em] text-primary">Ověř telefon</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pro pokračování musíš přidat svoje telefonní číslo a potvrdit, že ho opravdu vlastníš. Ověření probíhá jednorázovým SMS kódem.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
            <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>Telefon zůstává soukromý. Veřejné zobrazení se povoluje zvlášť v profilu.</p></div>
          </div>

          {step === "phone" ? (
            <div className="mt-5 space-y-3">
              <label className="block"><span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Telefon</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+420 731 179 919" className="mt-1.5 w-full rounded-xl border border-primary/25 bg-background/60 px-3 py-3 text-sm outline-none focus:border-primary/60" /></label>
              <button type="button" onClick={() => void sendOtp()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-50">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Poslat ověřovací SMS</button>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-accent/25 bg-accent/5 p-3 text-sm"><span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">SMS odeslána na</span><div className="mt-1 font-mono">{phone}</div></div>
              <label className="block"><span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Kód ze SMS</span><input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="mt-1.5 w-full rounded-xl border border-primary/25 bg-background/60 px-3 py-3 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-primary/60" /></label>
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setStep("phone")} disabled={busy} className="rounded-xl border border-border px-3 py-3 text-sm text-muted-foreground">Změnit číslo</button><button type="button" onClick={() => void verifyOtp()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Ověřit</button></div>
            </div>
          )}

          {(error || notice) && <div className="mt-4 rounded-xl border border-primary/20 bg-background/50 p-3 text-sm">{error && <p className="text-destructive">{error}</p>}{notice && <p className="text-accent">{notice}</p>}</div>}

          <div className="mt-6 flex justify-center"><button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" /> Odhlásit se</button></div>
        </section>
      </div>
    </div>
  );
}
