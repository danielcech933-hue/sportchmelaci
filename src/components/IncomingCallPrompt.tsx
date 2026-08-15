import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type RingingCall = {
  id: string;
  group_id: string | null;
  created_by: string;
  kind: "direct" | "group";
  created_at: string;
};

type Participant = { user_id: string; nickname: string; joined_at: string };

export function IncomingCallPrompt() {
  const { user } = useAuth();
  const [ringing, setRinging] = useState<RingingCall | null>(null);
  const [label, setLabel] = useState("Příchozí hovor");
  const [active, setActive] = useState<string | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) {
      setRinging(null);
      return;
    }
    const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data } = await supabase
      .from("call_rooms")
      .select("id,group_id,created_by,kind,created_at")
      .eq("status", "ringing")
      .neq("created_by", user.id)
      .gt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(8);
    const next = ((data ?? []) as RingingCall[]).find((c) => !dismissedRef.current.has(c.id)) ?? null;
    setRinging(next);
    if (!next) return;

    if (next.kind === "group" && next.group_id) {
      const { data: group } = await supabase.from("dm_groups").select("name").eq("id", next.group_id).maybeSingle();
      setLabel(group?.name ? `Skupinový hovor · ${group.name}` : "Skupinový hovor");
    } else {
      const { data: members } = await supabase.rpc("call_participant_snapshot", { _call_id: next.id });
      const caller = ((members ?? []) as Participant[]).find((p) => p.user_id !== user.id);
      setLabel(caller?.nickname ? `Volá ${caller.nickname}` : "Příchozí hovor");
    }
  }, [user]);

  useEffect(() => {
    void load();
    if (!user) return;
    const timer = window.setInterval(() => void load(), 1800);
    const ch = supabase
      .channel(`incoming-calls-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_rooms" }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_rooms" }, () => void load())
      .subscribe();
    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(ch);
    };
  }, [load, user]);

  const accept = async () => {
    if (!ringing) return;
    const { error } = await supabase.rpc("join_call", { _call_id: ringing.id });
    if (!error) {
      setActive(ringing.id);
      setRinging(null);
    }
  };

  const reject = async () => {
    if (!ringing) return;
    dismissedRef.current.add(ringing.id);
    await supabase.rpc("leave_call", { _call_id: ringing.id });
    setRinging(null);
  };

  if (!user) return null;

  return (
    <>
      {ringing && (
        <div className="fixed right-3 top-3 z-[95] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-accent/40 bg-background/95 shadow-[0_0_45px_-12px_var(--color-accent)] backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-accent/15 px-4 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-accent/40 bg-accent/10 text-accent animate-pulse"><Phone className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-accent">PŘÍCHOZÍ HOVOR</p><p className="truncate text-sm font-semibold">{label}</p></div>
          </div>
          <div className="flex gap-2 p-3">
            <button type="button" onClick={() => void reject()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-danger/30 px-3 py-2.5 text-sm text-danger hover:bg-danger/10"><PhoneOff className="h-4 w-4" /> Odmítnout</button>
            <button type="button" onClick={() => void accept()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-background shadow-[0_0_20px_-8px_var(--color-accent)]"><Phone className="h-4 w-4" /> Přijmout</button>
          </div>
        </div>
      )}
      {active && <IncomingVoiceCall callId={active} onClose={() => setActive(null)} />}
    </>
  );
}

function IncomingVoiceCall({ callId, onClose }: { callId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(false);
  const localRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());
  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("call_participant_snapshot", { _call_id: callId });
    setParticipants((data ?? []) as Participant[]);
  }, [callId]);

  const sendSignal = useCallback(async (recipientId: string | null, signal_type: string, payload: Record<string, unknown>) => {
    if (!user) return;
    await supabase.from("call_signals").insert({ call_id: callId, sender_id: user.id, recipient_id: recipientId, signal_type, payload: payload as never });
  }, [callId, user]);

  const ensurePeer = useCallback((peerId: string) => {
    if (!user || peerId === user.id) return null;
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    localRef.current?.getTracks().forEach((track) => pc.addTrack(track, localRef.current!));
    pc.onicecandidate = (event) => { if (event.candidate) void sendSignal(peerId, "ice-candidate", { candidate: event.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState)) { pc.close(); peersRef.current.delete(peerId); } };
    peersRef.current.set(peerId, pc);
    return pc;
  }, [sendSignal, user]);

  useEffect(() => {
    let dead = false;
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
      if (dead) stream.getTracks().forEach((t) => t.stop());
      else localRef.current = stream;
    }).catch(() => undefined);
    void refresh();
    const poll = window.setInterval(() => void refresh(), 1800);
    const ch = supabase.channel(`voice-${callId}-${user?.id ?? "guest"}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` }, async (event) => {
      const signal = event.new as { id: string; sender_id: string; recipient_id: string | null; signal_type: string; payload: any };
      if (!user || signal.sender_id === user.id || (signal.recipient_id && signal.recipient_id !== user.id) || seenRef.current.has(signal.id)) return;
      seenRef.current.add(signal.id);
      const pc = ensurePeer(signal.sender_id);
      if (!pc) return;
      if (signal.signal_type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(signal.sender_id, "answer", { sdp: answer });
      } else if (signal.signal_type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
      } else if (signal.signal_type === "ice-candidate" && signal.payload?.candidate) {
        try { await pc.addIceCandidate(signal.payload.candidate); } catch { /* ignore stale candidate */ }
      }
    }).subscribe();
    return () => {
      dead = true;
      window.clearInterval(poll);
      supabase.removeChannel(ch);
      localRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      void supabase.rpc("leave_call", { _call_id: callId });
    };
  }, [callId, ensurePeer, refresh, sendSignal, user]);

  useEffect(() => {
    if (!user) return;
    for (const participant of participants) {
      if (participant.user_id === user.id || participant.user_id >= user.id) continue;
      const pc = ensurePeer(participant.user_id);
      if (!pc) continue;
      void (async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(participant.user_id, "offer", { sdp: offer });
      })();
    }
  }, [participants, ensurePeer, sendSignal, user]);

  const toggleMute = () => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };

  return (
    <div className="fixed inset-0 z-[96] grid place-items-center bg-background/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-accent/35 bg-background shadow-[0_0_60px_-15px_var(--color-accent)]">
        <div className="flex items-center justify-between border-b border-accent/20 px-4 py-3"><div><div className="font-display text-xl tracking-wider text-accent">HOVOR</div><div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{participants.length} účastníků</div></div><button onClick={onClose} className="text-muted-foreground">×</button></div>
        <div className="p-4"><div className="grid grid-cols-2 gap-3">{participants.map((p) => <div key={p.user_id} className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-primary/25 bg-background"><Users className="h-5 w-5 text-primary" /></div><p className="mt-2 truncate text-sm font-semibold">{p.user_id === user?.id ? "Ty" : p.nickname}</p><p className="mt-1 font-mono text-[9px] uppercase text-accent">ONLINE</p></div>)}</div><div className="mt-4 flex justify-center gap-2"><button onClick={toggleMute} className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${muted ? "bg-danger text-white" : "border border-accent/30 text-accent"}`} aria-label={muted ? "Zapnout mikrofon" : "Ztlumit mikrofon"}>{muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button><button onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-danger text-white" aria-label="Položit"><PhoneOff className="h-4 w-4" /></button></div><p className="mt-3 text-center text-[10px] text-muted-foreground">Hlasový hovor používá WebRTC; Supabase slouží jen k signalizaci.</p></div>
      </div>
    </div>
  );
}
