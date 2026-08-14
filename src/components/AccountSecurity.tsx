import { useEffect, useState } from "react";
import { BellRing, KeyRound, Mail, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

function maskedPhone(phone: string | null | undefined) {
  if (!phone) return "Telefon není nastavený";
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 4)}••••${phone.slice(-2)}`;
}

export function AccountSecurity() {
  const { user, signOut } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "password" | "signout" | "sms" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(60);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_match_notification_preferences" as never).then(({ data }) => {
      const pref = data as { sms_enabled?: boolean; reminder_minutes?: number } | null;
      if (pref) {
        setSmsEnabled(Boolean(pref.sms_enabled));
        setReminderMinutes(Number(pref.reminder_minutes ?? 60));
      }
    });
  }, [user?.id]);

  if (!user) return null;
  const currentEmail = (user.email ?? "").toLowerCase();
  const phoneVerified = Boolean(user.phone && user.phone_confirmed_at);

  function clearMessages() {
    setNotice(null);
    setError(null);
  }

  async function changeEmail() {
    clearMessages();
    const email = newEmail.trim().toLowerCase();
    if (!email) { setError("Zadej nový e-mail."); return; }
    if (email === currentEmail) { setError("Tento e-mail už používáš."); return; }
    setBusy("email");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email });
      if (updateError) throw updateError;
      setNewEmail("");
      setNotice("Požadavek na změnu e-mailu byl odeslán.");
    } catch (err) { setError(err instanceof Error ? err.message : "Změna e-mailu selhala."); }
    finally { setBusy(null); }
  }

  async function changePassword() {
    clearMessages();
    if (newPassword.length < 8) { setError("Nové heslo musí mít alespoň 8 znaků."); return; }
    if (newPassword !== confirmPassword) { setError("Hesla se neshodují."); return; }
    setBusy("password");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword(""); setConfirmPassword(""); setNotice("Heslo bylo úspěšně změněno.");
    } catch (err) { setError(err instanceof Error ? err.message : "Změna hesla selhala."); }
    finally { setBusy(null); }
  }

  async function saveSmsPreferences(enabled: boolean) {
    clearMessages();
    if (enabled && !phoneVerified) {
      setError("SMS upozornění lze zapnout až po ověření telefonu.");
      setSmsEnabled(false);
      return;
    }
    setBusy("sms");
    try {
      const { error: upsertError } = await supabase.from("match_notification_preferences").upsert({
        user_id: user.id,
        sms_enabled: enabled,
        reminder_minutes: reminderMinutes,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;
      setSmsEnabled(enabled);
      setNotice(enabled ? "SMS připomínky zápasů jsou zapnuté." : "SMS připomínky jsou vypnuté.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastavení upozornění se nepodařilo uložit.");
    } finally { setBusy(null); }
  }

  async function handleSignOut() {
    clearMessages(); setBusy("signout");
    try { await signOut(); }
    catch (err) { setError(err instanceof Error ? err.message : "Odhlášení selhalo."); setBusy(null); }
  }

  return (
    <section className="mt-10 relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur sm:p-6">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
      <div className="relative">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="font-display text-xl tracking-[0.2em] text-primary neon-text sm:text-2xl">ÚČET A BEZPEČNOST</h2>
            <p className="mt-1 text-xs text-muted-foreground">Přihlašovací údaje, ověřený telefon a upozornění na zápasy.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4 text-primary" /> Ověřený telefon</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="font-mono text-sm text-foreground">{maskedPhone(user.phone)}</p>
              <span className={`rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest ${phoneVerified ? "border-accent/40 bg-accent/10 text-accent" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{phoneVerified ? "OVĚŘENO" : "NEOVĚŘENO"}</span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Telefon se veřejně nezobrazuje. Změnu čísla provedeš přes povinnou bezpečnostní bránu.</p>
          </div>

          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-accent" /> SMS upozornění na zápasy</div>
            <p className="mt-2 text-[11px] text-muted-foreground">Například: „Zápas vs. Dany — dnes 18:30 — Chmelová Aréna.“</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={smsEnabled} disabled={busy !== null || !phoneVerified} onChange={(e) => void saveSmsPreferences(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" /> Odesílat SMS</label>
              <select value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} disabled={!phoneVerified || busy !== null} className="rounded-md border border-border bg-background/60 px-2 py-1.5 font-mono text-[10px] uppercase">
                <option value={15}>15 min před</option><option value={30}>30 min před</option><option value={60}>1 hodinu před</option><option value={120}>2 hodiny před</option><option value={1440}>1 den před</option>
              </select>
            </div>
            {!phoneVerified && <p className="mt-2 text-[10px] text-destructive">Nejdřív ověř telefon.</p>}
          </div>

          <div className="rounded-xl border border-primary/20 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-4 w-4 text-primary" /> Přihlašovací e-mail</div>
            <p className="mt-2 break-all text-sm text-foreground">{user.email ?? "E-mail není dostupný"}</p>
            <div className="mt-3 flex gap-2">
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novy@email.cz" className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" />
              <button type="button" onClick={changeEmail} disabled={busy !== null} className="rounded-md border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">{busy === "email" ? "…" : "Změnit"}</button>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" /> Změna hesla</div>
            <div className="mt-3 grid gap-2">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nové heslo (min. 8 znaků)" minLength={8} className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Potvrdit nové heslo" minLength={8} className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" />
              <button type="button" onClick={changePassword} disabled={busy !== null} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-[0_0_20px_-6px_var(--color-primary)] disabled:opacity-50">{busy === "password" ? "Ukládám…" : "Změnit heslo"}</button>
            </div>
          </div>
        </div>

        {(error || notice) && <div className="mt-4 rounded-lg border border-primary/20 bg-background/50 p-3 text-sm">{error && <p className="text-destructive">{error}</p>}{notice && <p className="text-accent">{notice}</p>}</div>}

        <div className="mt-5 flex justify-end"><button type="button" onClick={handleSignOut} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"><LogOut className="h-3.5 w-3.5" />{busy === "signout" ? "Odhlášení…" : "Odhlásit účet"}</button></div>
      </div>
    </section>
  );
}
