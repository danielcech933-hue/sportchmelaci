import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import {
  dispatchIncomingCallEvent,
  notifyCallRecipients,
  onNativeCallAnswered,
  onNativeCallEnded,
  onNativeCallRejected,
  onNativeIncomingCall,
  registerNativeCallDevice,
} from "@/lib/native-call-bridge";

export function CallPushRegistrar() {
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const dispatched = new Set<string>();

    void registerNativeCallDevice().catch((error) => {
      console.warn("[calls] registration bootstrap failed", error);
    });

    const wire = async () => {
      const incoming = await onNativeIncomingCall((event) => {
        if (mounted) dispatchIncomingCallEvent("incoming", event);
      });
      const answered = await onNativeCallAnswered(async (event) => {
        if (!mounted) return;
        await supabase.rpc("join_call", { _call_id: event.callId });
        dispatchIncomingCallEvent("answered", event);
      });
      const rejected = await onNativeCallRejected(async (event) => {
        if (!mounted) return;
        await supabase.rpc("leave_call", { _call_id: event.callId });
        dispatchIncomingCallEvent("rejected", event);
      });
      const ended = await onNativeCallEnded(async (event) => {
        if (!mounted) return;
        await supabase.rpc("leave_call", { _call_id: event.callId });
        dispatchIncomingCallEvent("ended", event);
      });
      for (const handle of [incoming, answered, rejected, ended]) {
        if (handle) handles.push(handle);
      }
    };
    void wire();

    const dispatchOwnRingingCalls = async () => {
      if (!user || !mounted) return;
      const cutoff = new Date(Date.now() - 20_000).toISOString();
      const { data, error } = await supabase
        .from("call_rooms")
        .select("id,created_at")
        .eq("created_by", user.id)
        .eq("status", "ringing")
        .gt("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) return;
      for (const row of data ?? []) {
        const callId = String(row.id);
        if (dispatched.has(callId)) continue;
        dispatched.add(callId);
        await notifyCallRecipients(callId);
      }
    };

    void dispatchOwnRingingCalls();
    const timer = window.setInterval(() => void dispatchOwnRingingCalls(), 1200);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      void Promise.all(handles.map((handle) => handle.remove()));
    };
  }, [user]);

  return null;
}
