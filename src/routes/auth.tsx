import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) nav({ to: "/" });
  }, [loading, session, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
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

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Lobby</Link>
      <h1 className="mt-4 font-display text-4xl">{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "signin" ? "Welcome back to Courtside." : "Pick a nickname — your matches will show under it."}
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
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="rounded-md border border-border bg-background/60 px-3 py-2 outline-none focus:border-primary"
            required
          />
        </label>
        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
