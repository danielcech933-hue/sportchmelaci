import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Users, Plus, Send, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/lib/avatars";

export function DirectCallButton({ peerId }: { peerId: string }) {
  const [callId, setCallId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_call", { _peer_id: peerId, _group_id: null });
    setBusy(false);
    if (!error && data) setCallId(String(data));
  };
  return <>{callId && <CallOverlay callId={callId} onClose={() => setCallId(null)} />}<button type="button" onClick={() => void start()} disabled={busy} aria-label="Volat" className="rounded-lg border border-accent/30 p-2 text-accent hover:bg-accent/10 disabled:opacity-40"><Phone className="h-4 w-4" /></button></>;
}

export function GroupCallButton({ groupId }: { groupId: string }) {
  const [callId, setCallId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_call", { _peer_id: null, _group_id: groupId });
    setBusy(false);
    if (!error && data) setCallId(String(data));
  };
  return <>{callId && <CallOverlay callId={callId} onClose={() => setCallId(null)} />}<button type="button" onClick={() => void start()} disabled={busy} aria-label="Skupinový hovor" className="rounded-lg border border-accent/30 p-2 text-accent hover:bg-accent/10 disabled:opacity-40"><Phone className="h-4 w-4" /></button></>;
}

type Group = { id: string; name: string; created_by: string; created_at: string };
type Profile = { id: string; nickname: string; avatar_path: string | null };
type GroupMessage = { id: string; group_id: string; sender_id: string; content: string; created_at: string };

export function GroupChatHub({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newGroup, setNewGroup] = useState(false);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    const { data: mine } = await supabase.from("dm_group_members").select("group_id").eq("user_id", user.id);
    const ids = (mine ?? []).map((r) => r.group_id as string);
    if (!ids.length) { setGroups([]); return; }
    const { data } = await supabase.from("dm_groups").select("id,name,created_by,created_at").in("id", ids).order("created_at", { ascending: false });
    setGroups((data ?? []) as Group[]);
  }, [user]);

  useEffect(() => { void loadGroups(); }, [loadGroups]);

  useEffect(() => {
    supabase.from("profiles").select("id,nickname,avatar_path").order("nickname", { ascending: true }).limit(200).then(({ data }) => setProfiles((data ?? []) as Profile[]));
  }, []);

  const create = async () => {
    const trimmed = name.trim();
    if (!user || !trimmed || !members.length || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_dm_group", { _name: trimmed, _member_ids: members });
    setBusy(false);
    if (!error && data) {
      await loadGroups();
      const next = { id: String(data), name: trimmed, created_by: user.id, created_at: new Date().toISOString() };
      setSelected(next);
      setNewGroup(false);
      setName("");
      setMembers([]);
    }
  };

  if (selected) return <GroupChatPane group={selected} onBack={() => setSelected(null)} onClose={onClose} />;

  return <>
    <header className="flex items-center gap-2 border-b border-primary/20 px-3 py-3">
      <button aria-label="Zpět" onClick={onBack} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
      <Users className="h-4 w-4 text-primary" />
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">Skupinové chaty</span>
      <button aria-label="Zavřít" onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
    </header>
    <div className="flex-1 overflow-y-auto p-3">
      <button type="button" onClick={() => setNewGroup(true)} className="mb-3 flex w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 text-left text-sm text-primary hover:bg-primary/10"><Plus className="h-4 w-4" /> Nový skupinový chat</button>
      {!groups.length && <p className="px-2 py-6 text-xs text-muted-foreground">Zatím nemáš žádný skupinový chat.</p>}
      {groups.map((g) => <button key={g.id} type="button" onClick={() => setSelected(g)} className="flex w-full items-center gap-3 rounded-xl border-b border-primary/10 px-3 py-3 text-left hover:bg-primary/5"><div className="grid h-10 w-10 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent"><Users className="h-4 w-4" /></div><span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.name}</span><span className="font-mono text-[9px] text-muted-foreground">CHAT</span></button>)}
    </div>
    {newGroup && <div className="absolute inset-0 z-10 grid place-items-center bg-background/80 p-3 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-primary/30 bg-background p-4 shadow-[0_0_40px_-10px_var(--color-primary)]"><div className="flex items-center justify-between"><h3 className="font-display text-xl tracking-wider">NOVÁ SKUPINA</h3><button onClick={() => setNewGroup(false)}><X className="h-4 w-4" /></button></div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Název skupiny" className="mt-4 w-full rounded-xl border border-primary/25 bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60" /><div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-primary/15"><p className="px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Vyber hráče</p>{profiles.filter((p) => p.id !== user?.id).map((p) => { const checked = members.includes(p.id); return <button key={p.id} type="button" onClick={() => setMembers((v) => checked ? v.filter((id) => id !== p.id) : [...v, p.id])} className={`flex w-full items-center gap-3 border-t border-primary/10 px-3 py-2.5 text-left ${checked ? "bg-primary/10" : "hover:bg-primary/5"}`}><Avatar path={p.avatar_path} nickname={p.nickname} size={30} zoomable={false} /><span className="flex-1 truncate text-sm">{p.nickname}</span><span className={`h-4 w-4 rounded border ${checked ? "border-primary bg-primary" : "border-primary/30"}`} /></button>; })}</div><button type="button" disabled={busy || !name.trim() || !members.length} onClick={() => void create()} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">Vytvořit skupinu</button></div></div>}
  </>;
}

function GroupChatPane({ group, onBack, onClose }: { group: Group; onBack: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data: msgs }, { data: mems }] = await Promise.all([
      supabase.from("dm_group_messages").select("id,group_id,sender_id,content,created_at").eq("group_id", group.id).order("created_at", { ascending: true }).limit(500),
      supabase.from("dm_group_members").select("user_id").eq("group_id", group.id),
    ]);
    setMessages((msgs ?? []) as GroupMessage[]);
    setMembers((mems ?? []).map((m) => m.user_id as string));
  }, [group.id]);

  useEffect(() => { void load(); const ch = supabase.channel(`group-chat-${group.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_group_messages", filter: `group_id=eq.${group.id}` }, (p) => setMessages((v) => [...v, p.new as GroupMessage])).subscribe(); return () => { supabase.removeChannel(ch); }; }, [group.id, load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const send = async () => { const content = text.trim(); if (!user || !content) return; setText(""); const { error } = await supabase.from("dm_group_messages").insert({ group_id: group.id, sender_id: user.id, content }); if (error) setText(content); };

  const nicknameMap = useMemo(() => new Map<string,string>(), []);
  useEffect(() => { if (!members.length) return; supabase.from("profiles").select("id,nickname").in("id", members).then(({data}) => (data ?? []).forEach((p) => nicknameMap.set(p.id as string, p.nickname as string))); }, [members, nicknameMap]);

  return <>
    <header className="flex items-center gap-2 border-b border-primary/20 px-3 py-2.5"><button aria-label="Zpět" onClick={onBack} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button><div className="grid h-8 w-8 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent"><Users className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{group.name}</div><div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{members.length} hráčů</div></div><GroupCallButton groupId={group.id} /><button aria-label="Zavřít" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></header>
    <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">{!messages.length && <p className="py-6 text-center text-xs text-muted-foreground">Začni skupinovou konverzaci 👋</p>}{messages.map((m) => { const mine = m.sender_id === user?.id; return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "border border-primary/20 bg-primary/5"}`}><div className={`mb-1 text-[9px] font-semibold uppercase tracking-wider ${mine ? "text-primary-foreground/70" : "text-accent"}`}>{mine ? "Ty" : nicknameMap.get(m.sender_id) ?? "Hráč"}</div><p className="whitespace-pre-wrap break-words">{m.content}</p><p className={`mt-1 font-mono text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>{formatTime(m.created_at)}</p></div></div>; })}<div ref={bottomRef} /></div>
    <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-2 border-t border-primary/20 p-2.5"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Napsat do skupiny…" className="min-w-0 flex-1 rounded-xl border border-primary/25 bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/60" /><button type="submit" disabled={!text.trim()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4" /></button></form>
  </>;
}

function formatTime(iso: string) { return new Date(iso).toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }

function RemoteAudio({ stream }: { stream: MediaStream }) { const ref = useRef<HTMLAudioElement>(null); useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]); return <audio ref={ref} autoPlay playsInline />; }

function CallOverlay({ callId, onClose }: { callId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Array<{ user_id: string; nickname: string; joined_at: string }>>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [muted, setMuted] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const seenOffersRef = useRef<Set<string>>(new Set());

  const refreshParticipants = useCallback(async () => { const { data } = await supabase.rpc("call_participant_snapshot", { _call_id: callId }); setParticipants((data ?? []) as Array<{ user_id:string; nickname:string; joined_at:string }>); }, [callId]);

  const sendSignal = useCallback(async (recipientId: string | null, signal_type: string, payload: Record<string, unknown>) => { if (!user) return; await supabase.from("call_signals").insert({ call_id: callId, sender_id: user.id, recipient_id: recipientId, signal_type, payload }); }, [callId, user]);

  const createPeer = useCallback((peerId: string) => {
    if (!user || peerId === user.id || peersRef.current.has(peerId)) return peersRef.current.get(peerId) ?? null;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
    pc.onicecandidate = (e) => { if (e.candidate) void sendSignal(peerId, "ice-candidate", { candidate: e.candidate.toJSON() }); };
    pc.ontrack = (e) => setRemoteStreams((v) => ({ ...v, [peerId]: e.streams[0] }));
    pc.onconnectionstatechange = () => { if (["failed","closed","disconnected"].includes(pc.connectionState)) { pc.close(); peersRef.current.delete(peerId); setRemoteStreams((v) => { const n={...v}; delete n[peerId]; return n; }); } };
    peersRef.current.set(peerId, pc);
    return pc;
  }, [sendSignal, user]);

  const maybeOffer = useCallback(async (peerId: string) => { if (!user || user.id >= peerId) return; const pc = createPeer(peerId); if (!pc) return; const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await sendSignal(peerId, "offer", { sdp: offer }); }, [createPeer, sendSignal, user]);

  useEffect(() => {
    let cancelled=false;
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((s) => { if (cancelled) s.getTracks().forEach((t)=>t.stop()); else localStreamRef.current=s; }).catch(()=>{});
    void supabase.rpc("join_call", { _call_id: callId });
    void refreshParticipants();
    const interval = setInterval(() => void refreshParticipants(), 2000);
    const ch = supabase.channel(`call-${callId}-${user?.id ?? "guest"}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"call_signals", filter:`call_id=eq.${callId}` }, async (p) => {
        const s = p.new as { sender_id:string; recipient_id:string|null; signal_type:string; payload:any; id:string };
        if (!user || s.sender_id===user.id || (s.recipient_id && s.recipient_id!==user.id)) return;
        const pc = createPeer(s.sender_id);
        if (!pc) return;
        if (s.signal_type === "offer") {
          if (seenOffersRef.current.has(s.id)) return;
          seenOffersRef.current.add(s.id);
          await pc.setRemoteDescription(new RTCSessionDescription(s.payload.sdp));
          const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); await sendSignal(s.sender_id, "answer", { sdp: answer });
        } else if (s.signal_type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(s.payload.sdp));
        } else if (s.signal_type === "ice-candidate" && s.payload?.candidate) {
          try { await pc.addIceCandidate(s.payload.candidate); } catch { /* peer may not be ready */ }
        }
      }).subscribe();
    return () => { cancelled=true; clearInterval(interval); supabase.removeChannel(ch); localStreamRef.current?.getTracks().forEach((t)=>t.stop()); peersRef.current.forEach((pc)=>pc.close()); peersRef.current.clear(); void supabase.rpc("leave_call", { _call_id: callId }); if (!cancelled) onClose(); };
  }, [callId, createPeer, onClose, refreshParticipants, sendSignal, user]);

  useEffect(() => { for (const p of participants) { if (p.user_id !== user?.id) void maybeOffer(p.user_id); } }, [participants, user?.id, maybeOffer]);

  const toggleMute = () => { const next=!muted; localStreamRef.current?.getAudioTracks().forEach((t)=>{t.enabled=!next;}); setMuted(next); };
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-background/80 p-4 backdrop-blur-md"><div className="w-full max-w-lg overflow-hidden rounded-3xl border border-accent/35 bg-background shadow-[0_0_60px_-15px_var(--color-accent)]"><div className="flex items-center justify-between border-b border-accent/20 px-4 py-3"><div><div className="font-display text-xl tracking-wider text-accent">HOVOR</div><div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{participants.length} účastníků</div></div><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div><div className="p-4"><div className="grid grid-cols-2 gap-3">{participants.map((p) => <div key={p.user_id} className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-primary/25 bg-background"><Users className="h-5 w-5 text-primary" /></div><p className="mt-2 truncate text-sm font-semibold">{p.user_id===user?.id ? "Ty" : p.nickname}</p><p className="mt-1 font-mono text-[9px] uppercase text-accent">ONLINE</p></div>)}</div>{Object.values(remoteStreams).map((s, i)=><RemoteAudio key={i} stream={s} />)}<div className="mt-4 flex justify-center gap-2"><button onClick={toggleMute} aria-label={muted?"Zapnout mikrofon":"Ztlumit mikrofon"} className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${muted?"bg-danger text-white":"border border-accent/30 text-accent"}`}>{muted?<MicOff className="h-4 w-4" />:<Mic className="h-4 w-4" />}</button><button onClick={onClose} aria-label="Položit" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-danger text-white"><PhoneOff className="h-4 w-4" /></button></div><p className="mt-3 text-center text-[10px] text-muted-foreground">Hovor probíhá peer-to-peer přes WebRTC; server slouží pouze pro signalizaci.</p></div></div></div>;
}
