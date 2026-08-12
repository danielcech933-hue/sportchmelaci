import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  session: Session | null;
  user: User | null;
  nickname: string | null;
  balance: number;
  slotCZK: number;
  avatarPath: string | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [slotCZK, setSlotCZK] = useState<number>(10000);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string | undefined) {
    if (!uid) {
      setNickname(null);
      setBalance(0);
      setSlotCZK(10000);
      setAvatarPath(null);
      setIsAdmin(false);
      return;
    }

    // Keep core profile data working even while the wallet migration is being deployed.
    // A missing slot_czk column must never make the avatar/balance disappear.
    const [{ data: prof, error: profileError }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("nickname,balance,avatar_path").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    const p = prof as { nickname?: string; balance?: number; avatar_path?: string | null } | null;
    if (!profileError) {
      setNickname(p?.nickname ?? null);
      setBalance(Number(p?.balance ?? 0));
      setAvatarPath(p?.avatar_path ?? null);
    }
    setIsAdmin((roles ?? []).some((r) => r.role === "admin"));

    // slot_czk is optional until the authoritative wallet migration has run.
    const { data: walletProfile } = await supabase
      .from("profiles")
      .select("slot_czk")
      .eq("id", uid)
      .maybeSingle();
    const slotValue = Number((walletProfile as { slot_czk?: number } | null)?.slot_czk);
    setSlotCZK(Number.isFinite(slotValue) ? slotValue : 10000);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session?.user.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    nickname,
    balance,
    slotCZK,
    avatarPath,
    isAdmin,
    loading,
    signOut: async () => { await supabase.auth.signOut(); },
    refreshProfile: async () => loadProfile(session?.user.id),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
