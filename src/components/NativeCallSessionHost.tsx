import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, PhoneCall } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type Participant = { user_id: string; nickname: string; joined_at: string };
type ActiveCallEvent = { callId: string };

type PeerState = {
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
};

export function NativeCallSessionHost() {
  const { user } = useAuth();
  const [callId, setCallId] = useState<string | null>(null);

  useEffect(() => {
    const onAnswered = (event: Event) => {
      const detail = (event as CustomEvent<ActiveCallEvent>).detail;
      if (detail?.callId) setCallId(detail.callId);
    };
    const onEnded = (event: Event) => {
      const detail = (event as CustomEvent<ActiveCallEvent>).detail;
      if (!detail?.callId || detail.callId === callId) setCallId(null);
    };
    window.addEventListener("sportchmelaci:call:answered", onAnswered);
    window.addEventListener("sportchmelaci:call:ended", onEnded);
    return () => {
      window.removeEventListener("sportchmelaci:call:answered", onAnswered);
      window.removeEventListener("sportchmelaci:call:ended", onEnded);
    };
  }, [callId]);

  if (!user || !callId) return null;
  return <NativeVoiceCall callId={callId} onClose={() => setCallId(null)} />;
}

function NativeVoiceCall({ callId, onClose }: { callId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("call_participant_snapshot", { _call_id: callId });
    if (rpcError) setError(rpcError.message);
    setParticipants((data ?? []) as Participant[]);
  }, [callId]);

  const sendSignal = useCallback(async (recipientId: string | null, signalType: string, payload: Record<string, unknown>) => {
    if (!user) return;
    const { error: signalError } = await supabase.from("call_signals").insert({
      call_id: callId,
      sender_id: user.id,
      recipient_id: recipientId,
      signal_type: signalType,
      payload: payload as never,
    });
    if (signalError) setError(signalError.message);
  }, [callId, user]);

  const createPeer = useCallback((peerId: string) => {
    if (!user || peerId === user.id) return null;
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        ...(import.meta.env.VITE_TURN_URL ? [{
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        }] : []),
      ],
    });
    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));

    pc.onicecandidate = (event) => {
      if (event.candidate) void sendSignal(peerId, "ice-candidate", { candidate: event.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) {
        pc.close();
        peersRef.current.delete(peerId);
      }
    };
    pc.ontrack = (event) => {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.srcObject = event.streams[0];
      audio.dataset.callPeer = peerId;
      document.body.appendChild(audio);
    };

    const peer: PeerState = { pc, pendingCandidates: [] };
    peersRef.current.set(peerId, peer);
    return peer;
  }, [sendSignal, user]);

  useEffect(() => {
    let dead = false;
    void navigator.mediaDevices?.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (dead) stream.getTracks().forEach((track) => track.stop());
        else localStreamRef.current = stream;
      })
      .catch(() => setError("Mikrofon není povolený. Povol mikrofon pro SportChmeláci."));

    void refresh();
    const interval = window.setInterval(() => void refresh(), 1500);
    const channel = supabase
      .channel(`native-call-${callId}-${user?.id ?? "guest"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` }, async (event) => {
        const signal = event.new as { id: string; sender_id: string; recipient_id: string | null; signal_type: string; payload: any };
        if (!user || signal.sender_id === user.id || (signal.recipient_id && signal.recipient_id !== user.id) || seenRef.current.has(signal.id)) return;
        seenRef.current.add(signal.id);
        const peer = createPeer(signal.sender_id);
        if (!peer) return;
        try {
          if (signal.signal_type === "offer") {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            await sendSignal(signal.sender_id, "answer", { sdp: answer });
          } else if (signal.signal_type === "answer") {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
          } else if (signal.signal_type === "ice-candidate" && signal.payload?.candidate) {
            try {
              await peer.pc.addIceCandidate(signal.payload.candidate);
            } catch {
              peer.pendingCandidates.push(signal.payload.candidate);
            }
          }
        } catch (signalingError) {
          setError(signalingError instanceof Error ? signalingError.message : "WebRTC signal error");
        }
      })
      .subscribe();

    return () => {
      dead = true;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      peersRef.current.forEach(({ pc }) => pc.close());
      peersRef.current.clear();
      document.querySelectorAll("audio[data-call-peer]").forEach((node) => node.remove());
      void supabase.rpc("leave_call", { _call_id: callId });
    };
  }, [callId, createPeer, refresh, sendSignal, user]);

  useEffect(() => {
    if (!user) return;
    for (const participant of participants) {
      if (participant.user_id === user.id || participant.user_id >= user.id) continue;
      const peer = createPeer(participant.user_id);
      if (!peer || peer.pc.signalingState !== "stable") continue;
      void peer.pc.createOffer().then(async (offer) => {
        await peer.pc.setLocalDescription(offer);
        await sendSignal(participant.user_id, "offer", { sdp: offer });
      });
    }
  }, [createPeer, participants, sendSignal, user]);

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };

  const hangUp = async () => {
    await supabase.rpc("leave_call", { _call_id: callId });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[97] grid place-items-center bg-background/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-accent/35 bg-background shadow-[0_0_60px_-15px_var(--color-accent)]">
        <div className="flex items-center gap-3 border-b border-accent/20 px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-accent/35 bg-accent/10 text-accent"><PhoneCall className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><div className="font-display text-xl tracking-wider text-accent">HOVOR PŘIPOJEN</div><div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{participants.length} účastníků · WebRTC</div></div>
        </div>
        <div className="p-4">
          {error && <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            {participants.map((participant) => (
              <div key={participant.user_id} className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-primary/25 bg-background"><PhoneCall className="h-5 w-5 text-primary" /></div>
                <p className="mt-2 truncate text-sm font-semibold">{participant.user_id === user?.id ? "Ty" : participant.nickname}</p>
                <p className="mt-1 font-mono text-[9px] uppercase text-accent">PŘIPOJEN</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={toggleMute} className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${muted ? "bg-danger text-white" : "border border-accent/30 text-accent"}`} aria-label={muted ? "Zapnout mikrofon" : "Ztlumit mikrofon"}>{muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
            <button type="button" onClick={() => void hangUp()} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger text-white" aria-label="Položit"><PhoneOff className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
