import { useEffect, useState } from "react";
import { Phone, PhoneCall, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicVerifiedPhone } from "@/lib/phone-test.functions";

export function PublicPhoneActions({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const getPhone = useServerFn(getPublicVerifiedPhone);
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPhone({ data: { userId } }).then((data) => {
      if (alive) { setPhone(data?.phone ?? null); setLoading(false); }
    }).catch(() => { if (alive) { setPhone(null); setLoading(false); } });
    return () => { alive = false; };
  }, [getPhone, userId]);

  if (loading || !phone) {
    return isSelf ? <section className="mt-6 rounded-2xl border border-primary/20 bg-background/50 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Telefonní kontakt</div><p className="mt-1 text-xs text-muted-foreground">Veřejné číslo je vypnuté. Po ověření ho můžeš povolit v Účet a bezpečnost.</p></section> : null;
  }

  return <section className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-4 shadow-[0_0_28px_-12px_var(--color-accent)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4 text-accent" /> Telefonní kontakt</div><p className="mt-1 font-mono text-sm text-accent">{phone}</p><p className="mt-1 text-[10px] text-muted-foreground">Ověřený kontakt · uživatel povolil veřejné telefonní volání</p></div><a href={`tel:${phone}`} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background"><PhoneCall className="h-4 w-4" /> Volat</a></div></section>;
}
