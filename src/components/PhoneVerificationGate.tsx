import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyRound, LogOut, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getPhoneVerificationStatus, startTestPhoneVerification, verifyTestPhone } from "@/lib/phone-test.functions";

function normalizePhone(value: string) {
  const raw = value.trim().replace(/[\s().-]/g, "");
  return raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
}

export function PhoneVerificationGate({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const getStatus = useServerFn(getPhoneVerificationStatus);
  const startChallenge = useServerFn(startTestPhoneVerification);
  const verifyChallenge = useServerFn(verifyTestPhone);
  const [checked, setChecked] = useState(false);
  const [verified, setVerified] = useState(false);
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");
  const [pendingExpiresAt, setPendingExpiresAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await getStatus();
      setVerified(status.verified);
      if (status.phone) setPhone(status.phone);
      if (status.pending) {
        setPendingExpiresAt(status.pending.expiresAt);
        setPhone(status.pending.phone);
        setStep("otp");
      }
    } catch {
      setVerified(false);
    } finally {
      setChecked(true);
    }
  }, [getStatus]);

  useEffect(() => {
    if (!loading && user) void refresh();
  }, [loading, user, refresh]);

  if (loading || !user || !checked) return <>{children}</>;
  if (verified) return <>{children}</>;

  async function start() {
    setError(null); setNotice(null);
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("Zadej telefon v mezinárodním formátu, například +420731179919.");
      return;
    }
    setBusy(true);
    try {
      const result = await startChallenge({ data: { phone: normalized } });
      setPhone(normalized); setPendingExpiresAt(result.expiresAt); setStep("otp"); setOtp("");
      setNotice("TESTOVACÍ OVĚŘENÍ: administrátor dostane kód a předá ti ho osobně. Kód platí 10 minut.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo se vytvořit ověřovací výzvu.");
    } finally { setBusy(false); }
  }

  async function verify() {
    setError(null); setNotice(null);
    if (!/^\d{6}$/.test(otp)) { setError("Zadej přesně 6 číslic."); return; }
    setBusy(true);
    try {
      const result = await verifyChallenge({ data: { phone, otp } });
      if (!result.ok) {
        const messages: Record<string, string> = {
          invalid_code: "Nesprávný kód.", expired: "Kód vypršel. Vygeneruj nový.", locked: "Příliš mnoho pokusů. Vygeneruj nový kód.", no_challenge: "Ověřovací výzva neexistuje.", phone_mismatch: "Číslo neodpovídá aktivní výzvě.",
        };
        setError(messages[result.reason] ?? "Ověření selhalo.");
        return;
      }
      setVerified(true); setStep("phone"); setOtp(""); setNotice("Telefon je ověřený. Pokračujeme do SportChmeláci.");
    } catch (e) { setError(e instanceof Error ? e.message : "Ověření selhalo."); }
    finally { setBusy(false); }
  }

  const expiresText = pendingExpiresAt ? new Date(pendingExpiresAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="relative mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
        <section className="w-full overflow-hidden rounded-3xl border border-primary/30 bg-background/95 p-6 shadow-[0_0_80px_-24px_var(--color-primary)] backdrop-blur sm:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3 text-primary"><Phone className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1"><p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">SportChmeláci · Testovací bezpečnostní brána</p><h1 className="mt-1 font-display text-3xl uppercase tracking-[0.08em] text-primary">Ověř telefon</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Zadej své číslo. Prozatím nepoužíváme placené SMS služby: kód obdrží administrátor a předá ti ho osobně.</p></div>
          </div>
          <div className="mt-6 rounded-2xl border border-accent/25 bg-accent/5 p-4 text-xs text-muted-foreground"><div className="flex gap-2"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><p><b className="text-accent">TESTOVACÍ OVĚŘENÍ</b> · Kód není zobrazovaný běžnému uživateli. Administrátor ho vidí v zabezpečené admin části a předá ti ho ručně.</p></div></div>

          {step === "phone" ? (
            <div className="mt-5 space-y-3"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+420 731 179 919" className="w-full rounded-xl border border-primary/25 bg-background/60 px-3 py-3 text-sm outline-none focus:border-primary/60" /><button type="button" onClick={() => void start()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-50">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Vytvořit ověřovací kód</button></div>
          ) : (
            <div className="mt-5 space-y-3"><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Číslo</span><div className="mt-1 font-mono">{phone}</div>{expiresText && <div className="mt-1 text-[10px] text-muted-foreground">Platnost do {expiresText}</div>}</div><input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="w-full rounded-xl border border-primary/25 bg-background/60 px-3 py-3 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-primary/60" /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setStep("phone")} disabled={busy} className="rounded-xl border border-border px-3 py-3 text-sm text-muted-foreground">Změnit číslo</button><button type="button" onClick={() => void verify()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Ověřit kód</button></div></div>
          )}

          {(error || notice) && <div className="mt-4 rounded-xl border border-primary/20 bg-background/50 p-3 text-sm">{error && <p className="text-destructive">{error}</p>}{notice && <p className="text-accent">{notice}</p>}</div>}
          <div className="mt-6 flex justify-center"><button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" /> Odhlásit se</button></div>
        </section>
      </div>
    </div>
  );
}
