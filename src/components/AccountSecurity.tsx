import { useEffect, useState } from "react";
import { BellRing, KeyRound, Mail, LogOut, ShieldCheck, Smartphone, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

function normalizePhone(value: string) {
  const raw = value.trim().replace(/[\s()-]/g, "");
  return raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
}
function authPhoneError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("sms") || lower.includes("provider") || lower.includes("twilio")
    ? "SMS ověření není nakonfigurované. V Supabase zapni Authentication → Providers → Phone a nastav SMS provider (např. Twilio)."
    : message;
}

export function AccountSecurity() {
  const { user, signOut } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [otp, setOtp] = useState("");
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [phoneVerified, setPhoneVerified] = useState(Boolean(user?.phone && user?.phone_confirmed_at));
  const [busy, setBusy] = useState<"email" | "password" | "phone" | "otp" | "sms" | "publicPhone" | "signout" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [publicPhone, setPublicPhone] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(60);

  useEffect(() => {
    if (!user) return;
    setPhone(user.phone ?? "");
    setPhoneVerified(Boolean(user.phone && user.phone_confirmed_at));
    Promise.all([
      supabase.from("match_notification_preferences").select("reminder_minutes,sms_enabled").eq("user_id", user.id).maybeSingle(),
      supabase.from("phone_verifications").select("phone_public").eq("user_id", user.id).maybeSingle(),
    ]).then(([pref, publicRow]) => {
      const p = pref.data as { reminder_minutes?: number; sms_enabled?: boolean } | null;
      const pr = publicRow.data as { phone_public?: boolean } | null;
      setReminderMinutes(Number(p?.reminder_minutes ?? 60));
      setSmsEnabled(Boolean(p?.sms_enabled));
      setPublicPhone(Boolean(pr?.phone_public));
    }).catch(() => undefined);
  }, [user?.id, user?.phone, user?.phone_confirmed_at]);

  if (!user) return null;
  const currentEmail = (user.email ?? "").toLowerCase();
  const clearMessages = () => { setNotice(null); setError(null); };

  async function sendPhoneOtp() {
    clearMessages();
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return setError("Zadej telefon v mezinárodním formátu, například +420731179919.");
    setBusy("phone");
    try {
      const { error: e } = await supabase.auth.updateUser({ phone: normalized });
      if (e) throw e;
      setPhone(normalized); setOtp(""); setPhoneStep("otp");
      setNotice("Ověřovací SMS byla vyžádána. Zadej 6místný kód.");
    } catch (e) { setError(authPhoneError(e instanceof Error ? e.message : "Odeslání SMS selhalo.")); }
    finally { setBusy(null); }
  }

  async function verifyPhoneOtp() {
    clearMessages();
    if (!/^\d{6}$/.test(otp)) return setError("Zadej přesně 6 číslic z SMS.");
    setBusy("otp");
    try {
      const { error: e } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone), token: otp, type: "phone_change" });
      if (e) throw e;
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getUser();
      const verified = Boolean(data.user?.phone && data.user?.phone_confirmed_at);
      setPhoneVerified(verified);
      if (!verified) throw new Error("Telefon se nepodařilo označit jako ověřený.");
      setPhoneStep("phone"); setOtp(""); setNotice("Telefon je ověřený.");
    } catch (e) { setError(authPhoneError(e instanceof Error ? e.message : "Ověření SMS selhalo.")); }
    finally { setBusy(null); }
  }

  async function saveSmsPreferences(enabled: boolean) {
    clearMessages();
    if (!phoneVerified) return setError("Nejdřív ověř telefon SMS kódem.");
    setBusy("sms");
    try {
      const { error: e } = await supabase.from("match_notification_preferences").upsert({ user_id: user.id, sms_enabled: enabled, reminder_minutes: reminderMinutes, updated_at: new Date().toISOString() });
      if (e) throw e;
      setSmsEnabled(enabled); setNotice(enabled ? "SMS připomínky zápasů jsou zapnuté." : "SMS připomínky zápasů jsou vypnuté.");
    } catch (e) { setError(e instanceof Error ? e.message : "Nastavení SMS se nepodařilo uložit."); }
    finally { setBusy(null); }
  }

  async function savePublicPhone(enabled: boolean) {
    clearMessages();
    if (!phoneVerified) return setError("Telefon musí být nejdřív ověřený SMS kódem.");
    setBusy("publicPhone");
    try {
      const { data, error: e } = await supabase.rpc("set_phone_public", { _enabled: enabled });
      if (e) throw e;
      setPublicPhone(Boolean(data)); setNotice(enabled ? "Telefon je veřejný na profilu." : "Veřejné zobrazení telefonu je vypnuté.");
    } catch (e) { setError(e instanceof Error ? e.message : "Nastavení veřejného telefonu selhalo."); }
    finally { setBusy(null); }
  }

  async function changeEmail() {
    clearMessages(); const email = newEmail.trim().toLowerCase();
    if (!email) return setError("Zadej nový e-mail.");
    if (email === currentEmail) return setError("Tento e-mail už používáš.");
    setBusy("email");
    try { const { error: e } = await supabase.auth.updateUser({ email }); if (e) throw e; setNewEmail(""); setNotice("Požadavek na změnu e-mailu byl odeslán."); }
    catch (e) { setError(e instanceof Error ? e.message : "Změna e-mailu selhala."); }
    finally { setBusy(null); }
  }

  async function changePassword() {
    clearMessages(); if (newPassword.length < 8) return setError("Nové heslo musí mít alespoň 8 znaků."); if (newPassword !== confirmPassword) return setError("Hesla se neshodují.");
    setBusy("password");
    try { const { error: e } = await supabase.auth.updateUser({ password: newPassword }); if (e) throw e; setNewPassword(""); setConfirmPassword(""); setNotice("Heslo bylo úspěšně změněno."); }
    catch (e) { setError(e instanceof Error ? e.message : "Změna hesla selhala."); }
    finally { setBusy(null); }
  }

  async function handleSignOut() { clearMessages(); setBusy("signout"); try { await signOut(); } catch (e) { setError(e instanceof Error ? e.message : "Odhlášení selhalo."); setBusy(null); } }

  return (
    <section className="mt-10 relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur sm:p-6">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
      <div className="relative">
        <div className="flex items-start gap-3"><div className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-display text-xl tracking-[0.2em] text-primary neon-text sm:text-2xl">ÚČET A BEZPEČNOST</h2><p className="mt-1 text-xs text-muted-foreground">Telefon, SMS upozornění, volání a přihlašovací údaje.</p></div></div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-background/40 p-4 lg:col-span-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4 text-primary" /> Ověřený telefon <span className={`ml-auto rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest ${phoneVerified ? "border-accent/40 bg-accent/10 text-accent" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{phoneVerified ? "OVĚŘENO" : "NEOVĚŘENO"}</span></div>
            {phoneStep === "phone" ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+420 731 179 919" className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" /><button type="button" onClick={() => void sendPhoneOtp()} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy === "phone" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />} {phoneVerified ? "Ověřit nové číslo" : "Poslat ověřovací SMS"}</button></div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0,6))} inputMode="numeric" maxLength={6} placeholder="123456" className="rounded-md border border-border bg-background/60 px-3 py-2 text-center font-mono tracking-[0.35em] outline-none focus:border-primary" /><button type="button" onClick={() => setPhoneStep("phone")} disabled={busy !== null} className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Změnit</button><button type="button" onClick={() => void verifyPhoneOtp()} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy === "otp" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Ověřit kód</button></div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">Číslo zůstává soukromé, dokud výslovně nepovolíš veřejné zobrazení.</p>
          </div>

          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-accent" /> SMS upozornění na zápasy</div>
            <p className="mt-2 text-[11px] text-muted-foreground">Například: „Zápas vs. Dany — 18:30 — Chmelová Aréna.“</p>
            <div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={smsEnabled} disabled={!phoneVerified || busy !== null} onChange={(e) => void saveSmsPreferences(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" /> Odesílat SMS</label><select value={reminderMinutes} onChange={(e) => { setReminderMinutes(Number(e.target.value)); if (smsEnabled && phoneVerified) void saveSmsPreferences(true); }} disabled={!phoneVerified || busy !== null} className="rounded-md border border-border bg-background/60 px-2 py-1.5 font-mono text-[10px] uppercase"><option value={15}>15 min před</option><option value={30}>30 min před</option><option value={60}>1 hodinu před</option><option value={120}>2 hodiny před</option><option value={1440}>1 den před</option></select></div>
            {!phoneVerified && <p className="mt-2 text-[10px] text-destructive">Nejdřív ověř telefon výše.</p>}
          </div>

          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4 text-accent" /> Veřejné telefonní volání</div>
            <p className="mt-2 text-[11px] text-muted-foreground">Ve výchozím stavu je číslo soukromé. Po zapnutí se na veřejném profilu zobrazí číslo a tlačítko „Volat“.</p>
            <label className="mt-3 inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={publicPhone} disabled={!phoneVerified || busy !== null} onChange={(e) => void savePublicPhone(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" /> Veřejně zobrazovat moje číslo</label>
            {!phoneVerified && <p className="mt-2 text-[10px] text-destructive">Nejdřív ověř telefon výše.</p>}
          </div>

          <div className="rounded-xl border border-primary/20 bg-background/40 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-4 w-4 text-primary" /> Přihlašovací e-mail</div><p className="mt-2 break-all text-sm text-foreground">{user.email ?? "E-mail není dostupný"}</p><div className="mt-3 flex gap-2"><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novy@email.cz" className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" /><button type="button" onClick={changeEmail} disabled={busy !== null} className="rounded-md border border-primary/40 px-3 py-2 text-xs font-semibold text-primary">{busy === "email" ? "…" : "Změnit"}</button></div></div>

          <div className="rounded-xl border border-primary/20 bg-background/40 p-4 lg:col-span-2"><div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" /> Změna hesla</div><div className="mt-3 grid gap-2 md:grid-cols-2"><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nové heslo (min. 8 znaků)" minLength={8} className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Potvrdit nové heslo" minLength={8} className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" /><button type="button" onClick={changePassword} disabled={busy !== null} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{busy === "password" ? "Ukládám…" : "Změnit heslo"}</button></div></div>
        </div>

        {(error || notice) && <div className="mt-4 rounded-lg border border-primary/20 bg-background/50 p-3 text-sm">{error && <p className="text-destructive">{error}</p>}{notice && <p className="text-accent">{notice}</p>}</div>}
        <div className="mt-5 flex justify-end"><button type="button" onClick={handleSignOut} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive"> <LogOut className="h-3.5 w-3.5" />{busy === "signout" ? "Odhlášení…" : "Odhlásit účet"}</button></div>
      </div>
    </section>
  );
}
