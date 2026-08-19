import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useNicknames() {
  const [nicknames, setNicknames] = useState<string[]>([]);
  useEffect(() => {
    supabase.from("profile_public").select("nickname").order("nickname").then(({ data }) => {
      setNicknames((data ?? []).map((r) => r.nickname).filter((n): n is string => !!n));
    });
  }, []);
  return nicknames;
}

export const NICKNAMES_DATALIST_ID = "registered-nicknames";

export function NicknamesDatalist({ options }: { options: string[] }) {
  return (
    <datalist id={NICKNAMES_DATALIST_ID}>
      {options.map((n) => <option key={n} value={n} />)}
    </datalist>
  );
}
