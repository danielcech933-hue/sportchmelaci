import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Device = {
  user_id: string;
  platform: "ios" | "android" | "web";
  push_token: string | null;
  voip_token: string | null;
  device_id: string;
};

type CallRow = { id: string; created_by: string; kind: "direct" | "group"; status: string };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

function b64url(data: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem: string) {
  const base64 = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signEs256(message: string, pem: string) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(message),
  );
  return b64url(signature);
}

async function signRs256(message: string, pem: string) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(message),
  );
  return b64url(signature);
}

async function createAppleJwt() {
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");
  if (!teamId || !keyId || !privateKey) throw new Error("APNS secrets are not configured");
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  return `${header}.${payload}.${await signEs256(`${header}.${payload}`, privateKey)}`;
}

async function getFcmAccessToken() {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("FCM service account is not configured");
  const account = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const assertion = `${header}.${payload}.${await signRs256(`${header}.${payload}`, account.private_key)}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`FCM OAuth failed: ${await tokenResponse.text()}`);
  const token = await tokenResponse.json() as { access_token: string };
  return { accessToken: token.access_token, projectId: account.project_id };
}

async function sendApns(token: string, payload: Record<string, unknown>, voip: boolean) {
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  const environment = Deno.env.get("APNS_ENVIRONMENT") === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  if (!teamId || !bundleId) throw new Error("APNS configuration is incomplete");
  const jwt = await createAppleJwt();
  const headers: Record<string, string> = {
    authorization: `bearer ${jwt}`,
    "content-type": "application/json",
    "apns-topic": bundleId,
    "apns-priority": voip ? "10" : "10",
    "apns-expiration": "0",
    "apns-push-type": voip ? "voip" : "alert",
  };
  const response = await fetch(`https://${environment}/3/device/${encodeURIComponent(token)}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`APNs ${response.status}: ${await response.text()}`);
}

async function sendFcm(token: string, call: { id: string; callerName: string; video: boolean }) {
  const { accessToken, projectId } = await getFcmAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        data: {
          type: "call",
          callId: call.id,
          handle: `sportchmelaci:${call.id}`,
          displayName: call.callerName,
          handleType: "generic",
          video: String(call.video),
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`FCM ${response.status}: ${await response.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("missing_authorization");
    const token = authHeader.slice("Bearer ".length);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new Error("not_authenticated");

    const body = await req.json().catch(() => ({})) as { call_id?: string };
    if (!body.call_id) throw new Error("missing_call_id");

    const { data: call, error: callError } = await admin
      .from("call_rooms")
      .select("id,created_by,kind,status")
      .eq("id", body.call_id)
      .maybeSingle();
    if (callError) throw callError;
    if (!call || call.created_by !== authData.user.id) throw new Error("not_call_owner");
    if (call.status !== "ringing") throw new Error("call_not_ringing");

    const [{ data: participants, error: participantsError }, { data: profile, error: profileError }] = await Promise.all([
      admin.from("call_participants").select("user_id").eq("call_id", call.id).is("left_at", null).neq("user_id", authData.user.id),
      admin.from("profiles").select("nickname").eq("id", authData.user.id).maybeSingle(),
    ]);
    if (participantsError) throw participantsError;
    if (profileError) throw profileError;

    const recipientIds = (participants ?? []).map((row) => row.user_id as string);
    if (!recipientIds.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "content-type": "application/json" } });

    const { data: devices, error: devicesError } = await admin
      .from("call_devices")
      .select("user_id,platform,push_token,voip_token,device_id")
      .eq("enabled", true)
      .in("user_id", recipientIds);
    if (devicesError) throw devicesError;

    const callPayload = {
      id: call.id,
      callerName: profile?.nickname ?? "SportChmeláci",
      video: false,
    };
    const results: Array<Record<string, unknown>> = [];

    for (const device of (devices ?? []) as Device[]) {
      try {
        if (device.platform === "android" && device.push_token) {
          await sendFcm(device.push_token, callPayload);
          results.push({ deviceId: device.device_id, platform: device.platform, sent: true });
        } else if (device.platform === "ios") {
          if (device.voip_token) {
            await sendApns(device.voip_token, {
              aps: { "content-available": 1 },
              callId: call.id,
              displayName: callPayload.callerName,
              handle: `sportchmelaci:${call.id}`,
              video: false,
            }, true);
            results.push({ deviceId: device.device_id, platform: device.platform, sent: true, mode: "voip" });
          } else if (device.push_token) {
            await sendApns(device.push_token, {
              aps: {
                alert: { title: "Příchozí hovor", body: `${callPayload.callerName} ti volá` },
                sound: "default",
              },
              callId: call.id,
            }, false);
            results.push({ deviceId: device.device_id, platform: device.platform, sent: true, mode: "alert-fallback" });
          }
        }
      } catch (error) {
        results.push({ deviceId: device.device_id, platform: device.platform, sent: false, error: String(error) });
      }
    }

    return new Response(JSON.stringify({ sent: results.filter((r) => r.sent).length, total: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
