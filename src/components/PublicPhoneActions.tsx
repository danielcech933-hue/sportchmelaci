import { useEffect, useState } from "react";
import { Phone, PhoneCall, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function PublicPhoneActions({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    supabase.rpc("get_public_verified_phone", { _user_id: userId }).then(({ data, error }) => {
      if (!alive) return;
      if (!error && Array.isArray(data) && data[0]?.phone_number) setPhone(String(data[0].phone_number));
      else setPhone(null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [userId]);

  if (loading || !phone) {
    return isSelf ? (
      <section className="mt-6 rounded-2xl border border-primary/20 bg-background/50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Telefonní kontakt</div>
        <p className="mt-1 text-xs text-muted-foreground">Veřejné číslo je vypnuté. Zapni ho v Účet a bezpečnost, pokud chceš, aby ti ostatní mohli volat klasickým telefonem.</p>
      </section>
    ) : null;
  }

  return (
    <section className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-4 shadow-[0_0_28px_-12px_var(--color-accent)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Phone className="h-4 w-4 text-accent" /> Telefonní kontakt</div>
          <p className="mt-1 font-mono text-sm text-accent">{phone}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Ověřený kontakt · uživatel povolil veřejné telefonní volání</p>
        </div>
        <a href={`tel:${phone}`} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background shadow-[0_0_20px_-8px_var(--color-accent)]"><PhoneCall className="h-4 w-4" /> Volat</a>
      </div>
    </section>
  );
}
