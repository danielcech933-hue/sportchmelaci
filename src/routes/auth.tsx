import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type AuthMode = "signin" | "signup" | "reset-request" | "update-password";

function recoveryUrl() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("reset") === "1" || window.location.hash.includes("type=recovery");
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Courtside" },
      { name: "description", content: "Sign in or create your Courtside account to save your matches under your nickname." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>(() => (recoveryUrl() ? "update-password" : "signin"));
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session && mode !== "update-password") nav({ to: "/" });
  }, [loading, session, mode, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      if (mode === "reset-request") {
        if (!email.trim()) throw new Error("Zadej e-mail účtu.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth?reset=1`,
        });
        if (error) throw error;
        setNotice("Pokud účet existuje, poslali jsme na e-mail odkaz pro obnovu hesla.");
        return;
      }

      if (mode === "update-password") {
        if (password.length < 8) throw new Error("Nové heslo musí mít alespoň 8 znaků.");
        if (password !== confirmPassword) throw new Error("Hesla se neshodují.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setNotice("Heslo bylo změněno. Přesměrovávám…");
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => nav({ to: "/profile/" }), 500);
        return;
      }

      if (mode === "signup") {
        const nick = nickname.trim();
        if (nick.length < 2 || nick.length > 30) throw new Error("Nickname must be 2–30 characters.");
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { nickname: nick },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      nav({ to: "/" });
    } catch (e2: any) {
      setErr(e2?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const isRecovery = mode === "update-password";
  const isResetRequest = mode === "reset-request";

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Lobby</Link>
      <h1 className="mt-4 font-display text-4xl">
        {isRecovery ? "Nové heslo" : isResetRequest ? "Obnova hesla" : mode === "signin" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isRecovery
          ? "Nastav nové heslo pro svůj účet."
          : isResetRequest
            ? "Pošleme ti bezpečný odkaz pro nastavení nového hesla."
            : mode === "signin"
              ? "Welcome back to Courtside."
              : "Pick a nickname — your matches will show under it."}
      </p>

      <form onSubmit={submit} className="panel mt-6 grid gap-3 p-5">
        {mode === "signup" && (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Nickname</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              placeholder="e.g. rafa"
              className="rounded-md border border-border bg-background/60 px-3 py-2 outline-none focus:border-primary"
              required
            />
          </label>
        )}

        {!isRecovery && (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-border bg-background/60 px-3 py-2 outline-none focus:border-primary"
              required
            />
          </label>
        )}

        {!isResetRequest && (
          <>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{isRecovery ? "Nové heslo" : "Password"}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={isRecovery ? 8 : 6}
                className="rounded-md border border-border bg-background/60 px-3 py-2 outline-none focus:border-primary"
                required
              />
            </label>
            {isRecovery && (
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Potvrzení nového hesla</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  className="rounded-md border border-border bg-background/60 px-3 py-2 outline-none focus:border-primary"
                  required
                />
              </label>
            )}
          </>
        )}

        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
        {notice && <p className="text-sm text-accent">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Please wait…" : isRecovery ? "Nastavit nové heslo" : isResetRequest ? "Poslat odkaz" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>

        {!isRecovery && (
          <>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => { setMode("reset-request"); setErr(null); setNotice(null); }}
                className="text-xs text-primary hover:underline"
              >
                Zapomněl jsem heslo
              </button>
            )}
            {isResetRequest && (
              <button
                type="button"
                onClick={() => { setMode("signin"); setErr(null); setNotice(null); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Zpět na přihlášení
              </button>
            )}
            {mode === "signin" || mode === "signup" ? (
              <button
                type="button"
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); setNotice(null); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
              </button>
            ) : null}
          </>
        )}
      </form>
    </main>
  );
}
