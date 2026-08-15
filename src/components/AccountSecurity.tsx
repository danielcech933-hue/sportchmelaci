import { useEffect, useState } from "react";
import { BellRing, KeyRound, Mail, LogOut, ShieldCheck, Smartphone, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

function maskedPhone(phone: string | null | undefined, last4: string | null) {
  if (phone) return `${phone.slice(0, 4)}••••${phone.slice(-2)}`;
  return last4 ? `•••• ${last4}` : "Telefon není nastavený";
}

export function AccountSecurity() {
  const { user, signOut } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "password" | "signout" | "telegram" | "publicPhone" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramVerified, setTelegramVerified] = useState(false);
  const [phoneLast4, setPhoneLast4] = useState<string | null>(null);
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [publicPhone, setPublicPhone] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(60);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("telegram_verifications").select("verified_at,phone_last4,phone_public,notifications_enabled").eq("user_id", user.id).maybeSingle(),
      supabase.from("match_notification_preferences").select("reminder_minutes,telegram_enabled").eq("user_id", user.id).maybeSingle(),
    ]).then(([tg, pref]) => {
      const t = tg.data as { verified_at?: string | null; phone_last4?: string | null; phone_public?: boolean; notifications_enabled?: boolean } | null;
      const p = pref.data as { reminder_minutes?: number; telegram_enabled?: boolean } | null;
      setTelegramVerified(Boolean(t?.verified_at));
      setPhoneLast4(t?.phone_last4 ?? null);
      setPublicPhone(Boolean(t?.phone_public));
      setTelegramEnabled(p?.telegram_enabled ?? t?.notifications_enabled ?? true);
      setReminderMinutes(Number(p?.reminder_minutes ?? 60));
    }).catch(() => undefined);
  }, [user?.id]);

  if (!user) return null;
  const currentEmail = (user.email ?? "").toLowerCase();

  const clearMessages = () => { setNotice(null); setError(null); };

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

  async function saveTelegramPreferences(enabled: boolean) {
    clearMessages(); if (!telegramVerified) return setError("Nejdřív ověř telefon přes Telegram.");
    setBusy("telegram");
    try {
      const { error: e } = await supabase.from("match_notification_preferences").upsert({ user_id: user.id, telegram_enabled: enabled, reminder_minutes: reminderMinutes, updated_at: new Date().toISOString() });
      if (e) throw e;
      await supabase.from("telegram_verifications").update({ notifications_enabled: enabled }).eq("user_id", user.id);
      setTelegramEnabled(enabled); setNotice(enabled ? "Telegram připomínky zápasů jsou zapnuté." : "Telegram připomínky jsou vypnuté.");
    } catch (e) { setError(e instanceof Error ? e.message : "Nastavení upozornění se nepodařilo uložit."); }
    finally { setBusy(null); }
  }

  async function savePublicPhone(enabled: boolean) {
    clearMessages(); if (!telegramVerified) return setError("Telefon musí být ověřený přes Telegram.");
    setBusy("publicPhone");
    try { const { data, error: e } = await supabase.rpc("set_phone_public", { _enabled: enabled }); if (e) throw e; setPublicPhone(Boolean(data)); setNotice(enabled ? "Telefon je nyní veřejný na profilu a lze na něj volat." : "Veřejné zobrazení telefonu je vypnuté."); }
    catch (e) { setError(e instanceof Error ? e.message : "Nastavení veřejného telefonu selhalo."); }
    finally { setBusy(null); }
  }

  async function handleSignOut() { clearMessages(); setBusy("signout"); try { await signOut(); } catch (e) { setError(e instanceof Error ? e.message : "Odhlášení selhalo."); setBusy(null); } }

  return (
    <section className="mt-10 relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur sm:p-6">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
      <div className="relative">
        <div className="flex items-start gap-3"><div className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-display text-xl tracking-[0.2em] text-primary neon-text sm:text-2xl">ÚČET A BEZPEČNOST</h2><p className="mt-1 text-xs text-muted-foreground">Telefon, Telegram upozornění, volání a přihlašovací údaje.</p></div></div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4 text-primary" /> Ověřený telefon</div>
            <div className="mt-2 flex items-center justify-between gap-3"><p className="font-mono text-sm text-foreground">{maskedPhone(user.phone, phoneLast4)}</p><span className={`rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-widest ${telegramVerified ? "border-accent/40 bg-accent/10 text-accent" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{telegramVerified ? "OVĚŘENO PŘES TELEGRAM" : "NEOVĚŘENO"}</span></div>
            <p className="mt-2 text-[11px] text-muted-foreground">Ověření je zdarma přes Telegram. Telefon se veřejně ukazuje jen pokud to výslovně povolíš níže.</p>
          </div>

          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Send className="h-4 w-4 text-accent" /> Telegram upozornění na zápasy</div>
            <p className="mt-2 text-[11px] text-muted-foreground">Například: „Zápas vs. Dany — 18:30 — Chmelová Aréna.“</p>
            <div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={telegramEnabled} disabled={busy !== null || !telegramVerified} onChange={(e) => void saveTelegramPreferences(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" /> Odesílat přes Telegram</label><select value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} disabled={!telegramVerified || busy !== null} className="rounded-md border border-border bg-background/60 px-2 py-1.5 font-mono text-[10px] uppercase"><option value={15}>15 min před</option><option value={30}>30 min před</option><option value={60}>1 hodinu před</option><option value={120}>2 hodiny před</option><option value={1440}>1 den před</option></select></div>
            {!telegramVerified && <p className="mt-2 text-[10px] text-destructive">Nejdřív ověř telefon zdarma přes Telegram.</p>}
          </div>

          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4 text-accent" /> Veřejné telefonní volání</div>
            <p className="mt-2 text-[11px] text-muted-foreground">Ve výchozím stavu je telefon soukromý. Po zapnutí se na veřejném profilu zobrazí číslo a tlačítko „Volat“.</p>
            <label className="mt-3 inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={publicPhone} disabled={!telegramVerified || busy !== null} onChange={(e) => void savePublicPhone(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" /> Veřejně zobrazovat moje číslo</label>
            <p className="mt-2 text-[10px] text-muted-foreground">Zapínej jen pokud souhlasíš s veřejným sdílením telefonního čísla.</p>
          </div>

          <div className="rounded-xl border border-primary/20 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-4 w-4 text-primary" /> Přihlašovací e-mail</div><p className="mt-2 break-all text-sm text-foreground">{user.email ?? "E-mail není dostupný"}</p><div className="mt-3 flex gap-2"><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novy@email.cz" className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" /><button type="button" onClick={changeEmail} disabled={busy !== null} className="rounded-md border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">{busy === "email" ? "…" : "Změnit"}</button></div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-background/40 p-4 lg:col-span-2"><div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" /> Změna hesla</div><div className="mt-3 grid gap-2 md:grid-cols-2"><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nové heslo (min. 8 znaků)" minLength={8} className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Potvrdit nové heslo" minLength={8} className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" /><button type="button" onClick={changePassword} disabled={busy !== null} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy === "password" ? "Ukládám…" : "Změnit heslo"}</button></div></div>
        </div>

        {(error || notice) && <div className="mt-4 rounded-lg border border-primary/20 bg-background/50 p-3 text-sm">{error && <p className="text-destructive">{error}</p>}{notice && <p className="text-accent">{notice}</p>}</div>}
        <div className="mt-5 flex justify-end"><button type="button" onClick={handleSignOut} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"><LogOut className="h-3.5 w-3.5" />{busy === "signout" ? "Odhlášení…" : "Odhlásit účet"}</button></div>
      </div>
    </section>
  );
}
