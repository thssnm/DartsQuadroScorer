import { ApiHttpError, POCKETBASE_URL } from "../api/client";
import type { LiveSnapshot } from "./snapshot";

// Eigene Requests statt der Funktionen aus src/api/client.ts: jeder
// Livescore-Request bekommt ein hartes Timeout, der Ergebnis-Upload nicht.
export const LIVE_REQUEST_TIMEOUT_MS = 5000;

const recordsUrl = `${POCKETBASE_URL}/api/collections/livescore/records`;

const request = async (url: string, init: RequestInit): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Kein JSON - der Status reicht.
    }
    if (!response.ok) {
      const { message, data } = (body ?? {}) as { message?: unknown; data?: unknown };
      throw new ApiHttpError(
        response.status,
        typeof message === "string" && message ? message : `API request failed (${response.status})`,
        typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}
      );
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
};

const jsonHeaders = (token: string): Record<string, string> => ({
  // PocketBase erwartet das Token ohne "Bearer".
  Authorization: token,
  "Content-Type": "application/json",
});

const recordId = (body: unknown): string => {
  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !id) throw new Error("Antwort ohne Record-id");
  return id;
};

export const createLiveRecord = async (token: string, snapshot: LiveSnapshot): Promise<string> =>
  recordId(await request(recordsUrl, { method: "POST", headers: jsonHeaders(token), body: JSON.stringify(snapshot) }));

export const updateLiveRecord = async (token: string, id: string, snapshot: LiveSnapshot): Promise<void> => {
  await request(`${recordsUrl}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(snapshot),
  });
};

// null = kein Datensatz zu dieser matchId.
export const findLiveRecordId = async (token: string, matchId: string): Promise<string | null> => {
  const filter = encodeURIComponent(`matchId="${matchId.replace(/"/g, "")}"`);
  const body = (await request(`${recordsUrl}?filter=${filter}&perPage=1`, {
    headers: { Authorization: token },
  })) as { items?: unknown[] } | null;
  const first = body?.items?.[0];
  return first ? recordId(first) : null;
};

export const refreshLiveToken = async (token: string): Promise<{ token: string; email?: string }> => {
  const body = (await request(`${POCKETBASE_URL}/api/collections/users/auth-refresh`, {
    method: "POST",
    headers: { Authorization: token },
  })) as { token?: unknown; record?: { email?: unknown } } | null;
  if (typeof body?.token !== "string" || !body.token) throw new ApiHttpError(401, "Antwort ohne Token");
  const email = body.record?.email;
  return typeof email === "string" ? { token: body.token, email } : { token: body.token };
};
