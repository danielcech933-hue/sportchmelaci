import { useEffect } from "react";
import {
  dispatchIncomingCallEvent,
  onNativeCallAnswered,
  onNativeCallEnded,
  onNativeCallRejected,
  onNativeIncomingCall,
  registerNativeCallDevice,
} from "@/lib/native-call-bridge";

export function CallPushRegistrar() {
  useEffect(() => {
    let mounted = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    void registerNativeCallDevice().catch((error) => {
      console.warn("[calls] registration bootstrap failed", error);
    });

    const wire = async () => {
      const incoming = await onNativeIncomingCall((event) => {
        if (mounted) dispatchIncomingCallEvent("incoming", event);
      });
      const answered = await onNativeCallAnswered((event) => {
        if (mounted) dispatchIncomingCallEvent("answered", event);
      });
      const rejected = await onNativeCallRejected((event) => {
        if (mounted) dispatchIncomingCallEvent("rejected", event);
      });
      const ended = await onNativeCallEnded((event) => {
        if (mounted) dispatchIncomingCallEvent("ended", event);
      });
      for (const handle of [incoming, answered, rejected, ended]) {
        if (handle) handles.push(handle);
      }
    };
    void wire();

    return () => {
      mounted = false;
      void Promise.all(handles.map((handle) => handle.remove()));
    };
  }, []);

  return null;
}
