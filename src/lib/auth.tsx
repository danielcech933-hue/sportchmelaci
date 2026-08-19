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
const DEFAULT_SLOT_CZK = 10000;

type ProfileRow = {
  nickname?: string | null;
  balance?: number | null;
  slot_czk?: number | null;
  avatar_path?: string | null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [slotCZK, setSlotCZK] = useState<number>(DEFAULT_SLOT_CZK);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string | undefined) {
    if (!uid) {
      setNickname(null);
      setBalance(0);
      setSlotCZK(DEFAULT_SLOT_CZK);
      setAvatarPath(null);
      setIsAdmin(false);
      return;
    }

    // Public profile fields come from the safe `profile_public` projection.
    // Wallet balances are only ever read through the secure get_my_wallet() RPC.
    const [{ data: prof, error: profileError }, wallet, { data: roles }] = await Promise.all([
      supabase
        .from("profile_public")
        .select("nickname,avatar_path")
        .eq("id", uid)
        .maybeSingle(),
      fetchMyWallet(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    if (!profileError) {
      const p = prof as ProfileRow | null;
      setNickname(p?.nickname ?? null);
      setAvatarPath(p?.avatar_path ?? null);
    }

    if (wallet) {
      setBalance(wallet.balance);
      setSlotCZK(Number.isFinite(wallet.slotCZK) ? wallet.slotCZK : DEFAULT_SLOT_CZK);
    }

    setIsAdmin((roles ?? []).some((r) => r.role === "admin"));

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
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshProfile: async () => loadProfile(session?.user.id),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
