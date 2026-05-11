// Firebase Cloud Messaging (HTTP v1) helper using a service account.
// Runs in the Worker SSR runtime via Web Crypto (no node-only deps).

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedToken: { token: string; exp: number } | null = null;

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) {
    throw new Error("Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY");
  }
  // env vars often store \n as literal — normalize
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const header = { alg: "RS256", typ: "JWT" };
  const iat = now;
  const exp = now + 3600;
  const claim = {
    iss: clientEmail,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    iat,
    exp,
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`FCM token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

export async function sendFcmToTokens(
  tokens: string[],
  title: string,
  body: string,
): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Missing FIREBASE_PROJECT_ID");
  if (tokens.length === 0) return { success: 0, failure: 0, invalidTokens: [] };

  const accessToken = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  let success = 0;
  let failure = 0;
  const invalidTokens: string[] = [];

  // Send sequentially in small batches to avoid hammering the API
  const BATCH = 20;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const slice = tokens.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      slice.map((token) =>
        fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
            },
          }),
        }).then(async (r) => {
          if (r.ok) return { ok: true as const, token };
          const text = await r.text();
          const isInvalid =
            r.status === 404 ||
            r.status === 400 ||
            /UNREGISTERED|INVALID_ARGUMENT/i.test(text);
          return { ok: false as const, token, status: r.status, text, isInvalid };
        }),
      ),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) success++;
      else {
        failure++;
        if (r.status === "fulfilled" && r.value.isInvalid) {
          invalidTokens.push(r.value.token);
        }
      }
    }
  }

  return { success, failure, invalidTokens };
}
