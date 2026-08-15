import { useCallback, useEffect, useState } from "react";
import { BellRing, KeyRound, Mail, LogOut, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getAdminTestPhoneChallenges, getPhoneVerificationStatus, setPublicPhoneForSelf, startTestPhoneVerification, verifyTestPhone } from "@/lib/phone-test.functions";

function normalizePhone(value: string) {
  const raw = value.trim().replace(/[\s().-]/g, "");
  return raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
}

type Busy = "email" | "password" | "phone" | "otp" | "sms" | "publicPhone" | "signout" | null;
type Challenge = { userId: string; email: string | null; phone: string; issuedAt: number; expiresAt: number; attempts: number; code: string };

export function AccountSecurity() {
  const { user, isAdmin, signOut } = useAuth();
  const getStatus = useServerFn(getPhoneVerificationStatus);
  const startChallenge = useServerFn(startTestPhoneVerification);
  const verifyChallenge = useServerFn(verifyTestPhone);
  const setPublicPhone = useServerFn(setPublicPhoneForSelf);
  const loadAdminChallenges = useServerFn(getAdminTestPhoneChallenges);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [publicPhone, setPublicPhoneState] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(60);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const clearMessages = () => { setNotice(null); setError(null); };

  const refreshPhone = useCallback(async () => {
    const status = await getStatus();
    setPhoneVerified(status.verified);
    if (status.phone) setPhone(status.phone);
    if (status.pending) { setPhone(status.pending.phone); setPhoneStep("otp"); }
    const { data: pv } = await supabase.from("phone_verifications").select("phone_public").eq("user_id", user?.id ?? "").maybeSingle();
    setPublicPhoneState(Boolean((pv as { phone_public?: boolean } | null)?.phone_public));
  }, [getStatus, user?.id]);

  const refreshAdminChallenges = useCallback(async () => {
    if (!isAdmin) return;
    setAdminLoading(true);
    try { setChallenges((await loadAdminChallenges()) as Challenge[]); }
    catch { setChallenges([]); }
    finally { setAdminLoading(false); }
  }, [isAdmin, loadAdminChallenges]);

  useEffect(() => {
    if (!user) return;
    void refreshPhone();
    supabase.from("match_notification_preferences").select("reminder_minutes,sms_enabled").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      const p = data as { reminder_minutes?: number; sms_enabled?: boolean } | null;
      setReminderMinutes(Number(p?.reminder_minutes ?? 60));
      setSmsEnabled(Boolean(p?.sms_enabled));
    });
  }, [user?.id, refreshPhone]);

  useEffect(() => { if (isAdmin) void refreshAdminChallenges(); }, [isAdmin, refreshAdminChallenges]);

  if (!user) return null;
  const currentEmail = (user.email ?? "").toLowerCase();

  async function startPhone() {
    clearMessages();
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return setError("Zadej telefon v mezinárodním formátu, například +420731179919.");
    setBusy("phone");
    try { const res = await startChallenge({ data: { phone: normalized } }); setPhone(normalized); setPhoneStep("otp"); setOtp(""); setNotice(`TESTOVACÍ OVĚŘENÍ: administrátor ti předá kód. Platí do ${new Date(res.expiresAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}.`); if (isAdmin) void refreshAdminChallenges(); }
    catch (e) { setError(e instanceof Error ? e.message : "Nepodařilo se vytvořit ověřovací výzvu."); }
    finally { setBusy(null); }
  }

  async function verifyPhone() {
    clearMessages();
    if (!/^\d{6}$/.test(otp)) return setError("Zadej přesně 6 číslic.");
    setBusy("otp");
    try {
      const res = await verifyChallenge({ data: { phone, otp } });
      if (!res.ok) { const m: Record<string,string> = { invalid_code: "Nesprávný kód.", expired: "Kód vypršel.", locked: "Příliš mnoho pokusů.", no_challenge: "Ověřovací výzva neexistuje.", phone_mismatch: "Číslo neodpovídá výzvě." }; setError(m[res.reason] ?? "Ověření selhalo."); return; }
      setPhoneVerified(true); setPhoneStep("phone"); setOtp(""); setNotice("Telefon je úspěšně ověřený.");
    } catch (e) { setError(e instanceof Error ? e.message : "Ověření selhalo."); }
    finally { setBusy(null); }
  }

  async function savePublic(enabled: boolean) {
    clearMessages(); if (!phoneVerified) return setError("Nejdřív ověř telefon."); setBusy("publicPhone");
    try { await setPublicPhone({ data: { enabled } }); setPublicPhoneState(enabled); setNotice(enabled ? "Telefon je nyní veřejně dostupný na profilu." : "Veřejné zobrazení telefonu je vypnuté."); }
    catch (e) { setError(e instanceof Error ? e.message : "Nastavení veřejného telefonu selhalo."); }
    finally { setBusy(null); }
  }

  async function saveSms(enabled: boolean) {
    clearMessages(); if (!phoneVerified) return setError("Nejdřív ověř telefon."); setBusy("sms");
    try { const { error: e } = await supabase.from("match_notification_preferences").upsert({ user_id: user.id, sms_enabled: enabled, reminder_minutes: reminderMinutes, updated_at: new Date().toISOString() }); if (e) throw e; setSmsEnabled(enabled); setNotice(enabled ? "SMS připomínky jsou zapnuté. Skutečné doručování čeká na SMS provider." : "SMS připomínky jsou vypnuté."); }
    catch (e) { setError(e instanceof Error ? e.message : "Nastavení upozornění selhalo."); }
    finally { setBusy(null); }
  }

  async function changeEmail() {
    clearMessages(); const email = newEmail.trim().toLowerCase(); if (!email) return setError("Zadej nový e-mail."); if (email === currentEmail) return setError("Tento e-mail už používáš."); setBusy("email");
    try { const { error: e } = await supabase.auth.updateUser({ email }); if (e) throw e; setNewEmail(""); setNotice("Požadavek na změnu e-mailu byl odeslán."); } catch (e) { setError(e instanceof Error ? e.message : "Změna e-mailu selhala."); } finally { setBusy(null); }
  }

  async function changePassword() {
    clearMessages(); if (newPassword.length < 8) return setError("Nové heslo musí mít alespoň 8 znaků."); if (newPassword !== confirmPassword) return setError("Hesla se neshodují."); setBusy("password");
    try { const { error: e } = await supabase.auth.updateUser({ password: newPassword }); if (e) throw e; setNewPassword(""); setConfirmPassword(""); setNotice("Heslo bylo změněno."); } catch (e) { setError(e instanceof Error ? e.message : "Změna hesla selhala."); } finally { setBusy(null); }
  }

  return (
    <section className="mt-10 relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur sm:p-6">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
      <div className="relative">
        <div className="flex items-start gap-3"><div className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-display text-xl tracking-[0.2em] text-primary neon-text sm:text-2xl">ÚČET A BEZPEČNOST</h2><p className="mt-1 text-xs text-muted-foreground">Telefon, testovací ověření, upozornění, volání a přihlašovací údaje.</p></div></div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-background/40 p-4 lg:col-span-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4 text-primary" /> Ověřený telefon <span className={`ml-auto rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest ${phoneVerified ? "border-accent/40 bg-accent/10 text-accent" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{phoneVerified ? "OVĚŘENO" : "NEOVĚŘENO"}</span></div>
            {phoneStep === "phone" ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+420 731 179 919" className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" /><button type="button" onClick={() => void startPhone()} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy === "phone" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />} {phoneVerified ? "Ověřit nové číslo" : "Vytvořit ověřovací kód"}</button></div> : <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0,6))} inputMode="numeric" maxLength={6} placeholder="123456" className="rounded-md border border-border bg-background/60 px-3 py-2 text-center font-mono tracking-[0.35em] outline-none focus:border-primary" /><button type="button" onClick={() => setPhoneStep("phone")} disabled={busy !== null} className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Změnit</button><button type="button" onClick={() => void verifyPhone()} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy === "otp" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Ověřit kód</button></div>}
            <p className="mt-2 text-[11px] text-muted-foreground">TEST MODE: kód vytváří server a administrátor ho předá ručně. Žádný SMS provider není potřeba.</p>
          </div>

          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-accent" /> SMS upozornění na zápasy</div><p className="mt-2 text-[11px] text-muted-foreground">Nastavení připomínek je připravené; skutečné odeslání SMS začne až po připojení provideru.</p><div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={smsEnabled} disabled={!phoneVerified || busy !== null} onChange={(e) => void saveSms(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" /> Odesílat SMS</label><select value={reminderMinutes} onChange={(e) => { setReminderMinutes(Number(e.target.value)); if (smsEnabled && phoneVerified) void saveSms(true); }} disabled={!phoneVerified || busy !== null} className="rounded-md border border-border bg-background/60 px-2 py-1.5 font-mono text-[10px] uppercase"><option value={15}>15 min před</option><option value={30}>30 min před</option><option value={60}>1 hodinu před</option><option value={120}>2 hodiny před</option><option value={1440}>1 den před</option></select></div></div>

          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4 text-accent" /> Veřejné telefonní volání</div><p className="mt-2 text-[11px] text-muted-foreground">Po ověření můžeš explicitně povolit zobrazení čísla na veřejném profilu.</p><label className="mt-3 inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={publicPhone} disabled={!phoneVerified || busy !== null} onChange={(e) => void savePublic(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" /> Veřejně zobrazovat moje číslo</label></div>

          <div className="rounded-xl border border-primary/20 bg-background/40 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-4 w-4 text-primary" /> Přihlašovací e-mail</div><p className="mt-2 break-all text-sm">{user.email ?? "E-mail není dostupný"}</p><div className="mt-3 flex gap-2"><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novy@email.cz" className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none" /><button type="button" onClick={changeEmail} disabled={busy !== null} className="rounded-md border border-primary/40 px-3 py-2 text-xs font-semibold text-primary">{busy === "email" ? "…" : "Změnit"}</button></div></div>

          <div className="rounded-xl border border-primary/20 bg-background/40 p-4 lg:col-span-2"><div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" /> Změna hesla</div><div className="mt-3 grid gap-2 md:grid-cols-2"><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nové heslo (min. 8 znaků)" className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm" /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Potvrdit nové heslo" className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm" /><button type="button" onClick={changePassword} disabled={busy !== null} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{busy === "password" ? "Ukládám…" : "Změnit heslo"}</button></div></div>
        </div>

        {isAdmin && <section className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300">ADMIN · TESTOVACÍ OTP</div><p className="mt-1 text-xs text-muted-foreground">Tyto kódy jsou pouze pro ruční předání uživatelům a platí 10 minut.</p></div><button type="button" onClick={() => void refreshAdminChallenges()} disabled={adminLoading} className="inline-flex items-center gap-2 rounded-md border border-amber-400/30 px-3 py-2 text-xs text-amber-200">{adminLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "↻"} Obnovit</button></div>{challenges.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">Žádné aktivní testovací výzvy.</p> : <div className="mt-3 grid gap-2">{challenges.map((c) => <div key={`${c.userId}-${c.issuedAt}`} className="rounded-lg border border-amber-400/20 bg-background/60 p-3"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold">{c.email ?? c.userId.slice(0,8)}</span><span className="font-mono text-muted-foreground">{c.phone}</span><span className="ml-auto text-[10px] text-muted-foreground">do {new Date(c.expiresAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">KÓD PRO UŽIVATELE</span><code className="rounded bg-amber-300/10 px-3 py-1.5 font-mono text-lg tracking-[0.25em] text-amber-200">{c.code}</code></div></div>)}</div>}</section>}

        {(error || notice) && <div className="mt-4 rounded-lg border border-primary/20 bg-background/50 p-3 text-sm">{error && <p className="text-destructive">{error}</p>}{notice && <p className="text-accent">{notice}</p>}</div>}
        <div className="mt-5 flex justify-end"><button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive"><LogOut className="h-3.5 w-3.5" /> Odhlásit účet</button></div>
      </div>
    </section>
  );
}
