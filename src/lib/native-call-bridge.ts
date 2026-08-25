import { Capacitor } from "@capacitor/core";
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

type PushPermission = { receive: "prompt" | "prompt-with-rationale" | "granted" | "denied" };

type RegistrationEvent = { value: string };
type VoipTokenEvent = { token: string };
type NativeCallEvent = {
  callId: string;
  handle?: string;
  displayName?: string;
  handleType?: string;
  video?: boolean;
};

type CapacitorPushCallsPlugin = {
  checkPermissions(): Promise<PushPermission>;
  requestPermissions(): Promise<PushPermission>;
  register(): Promise<void>;
  registerVoipNotifications(): Promise<void>;
  addListener(event: "registration", listener: (event: RegistrationEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "registrationError", listener: (event: { error: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "voipPushToken", listener: (event: VoipTokenEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "incomingCall", listener: (event: NativeCallEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "callAnswered", listener: (event: NativeCallEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "callRejected", listener: (event: NativeCallEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "callEnded", listener: (event: NativeCallEvent) => void): Promise<PluginListenerHandle>;
  startCall(options: { handle: string; displayName: string; handleType: string; video: boolean }): Promise<{ callId: string }>;
  endCall(options: { callId: string }): Promise<void>;
  setMuted(options: { muted: boolean }): Promise<void>;
};

// Resolved only on native builds after @kapsula-chat/capacitor-push-calls has been
// installed and synced. Keeping this as a registered Capacitor plugin lets the
// web build stay dependency-light while the native wrapper provides PushKit,
// CallKit and Android ConnectionService.
export const CapacitorPushCalls = registerPlugin<CapacitorPushCallsPlugin>("CapacitorPushCalls");

export function isNativeCallsAvailable() {
  return Capacitor.isNativePlatform();
}

function makeDeviceId() {
  const key = "sportchmelaci.call.device.id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, id);
  return id;
}

export async function registerNativeCallDevice() {
  if (!Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform() as "ios" | "android";
  const deviceId = makeDeviceId();

  try {
    let permissions = await CapacitorPushCalls.checkPermissions();
    if (permissions.receive !== "granted") permissions = await CapacitorPushCalls.requestPermissions();
    if (permissions.receive !== "granted") return;

    await CapacitorPushCalls.register();
    if (platform === "ios") await CapacitorPushCalls.registerVoipNotifications();
  } catch (error) {
    console.warn("[calls] native registration unavailable", error);
  }

  const registration = await CapacitorPushCalls.addListener("registration", async ({ value }) => {
    await registerDeviceWithBackend({ deviceId, platform, pushToken: value, voipToken: null });
  });
  const voip = await CapacitorPushCalls.addListener("voipPushToken", async ({ token }) => {
    await registerDeviceWithBackend({ deviceId, platform, pushToken: null, voipToken: token });
  });

  return { registration, voip, deviceId };
}

async function registerDeviceWithBackend(args: {
  deviceId: string;
  platform: "ios" | "android";
  pushToken: string | null;
  voipToken: string | null;
}) {
  const appVersion = typeof document !== "undefined" ? document.documentElement.getAttribute("data-app-version") : null;
  const { error } = await supabase.rpc("register_call_device", {
    _device_id: args.deviceId,
    _platform: args.platform,
    _push_token: args.pushToken ?? undefined,
    _voip_token: args.voipToken ?? undefined,
    _app_version: appVersion ?? undefined,
  });
  if (error) console.warn("[calls] device registration failed", error);
}

export async function notifyCallRecipients(callId: string) {
  const { error } = await supabase.functions.invoke("send-call-push", { body: { call_id: callId } });
  if (error) console.warn("[calls] push dispatch failed", error);
}

export function onNativeIncomingCall(listener: (event: NativeCallEvent) => void) {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  return CapacitorPushCalls.addListener("incomingCall", listener);
}

export function onNativeCallAnswered(listener: (event: NativeCallEvent) => void) {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  return CapacitorPushCalls.addListener("callAnswered", listener);
}

export function onNativeCallRejected(listener: (event: NativeCallEvent) => void) {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  return CapacitorPushCalls.addListener("callRejected", listener);
}

export function onNativeCallEnded(listener: (event: NativeCallEvent) => void) {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  return CapacitorPushCalls.addListener("callEnded", listener);
}

export function dispatchIncomingCallEvent(name: "incoming" | "answered" | "rejected" | "ended", detail: NativeCallEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`sportchmelaci:call:${name}`, { detail }));
}
