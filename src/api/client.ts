// PocketBase-Anbindung (zweites Upload-Ziel neben dem Gist).

const DEFAULT_POCKETBASE_URL = "https://api.thssn.dev";

export const POCKETBASE_URL = (
  (import.meta.env.VITE_POCKETBASE_URL as string | undefined)?.trim() || DEFAULT_POCKETBASE_URL
).replace(/\/+$/, "");

const collectionUrl = (path: string): string => `${POCKETBASE_URL}/api/collections/${path}`;

// Antwort mit Fehlerstatus. data enthält bei PocketBase die Feldfehler,
// z.B. { matchId: { code: "validation_not_unique", ... } }.
export class ApiHttpError extends Error {
  readonly status: number;
  readonly data: Record<string, unknown>;

  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.data = data;
  }
}

const assertOk = async (response: Response): Promise<void> => {
  if (response.ok) return;
  let message = `API request failed (${response.status})`;
  let data: Record<string, unknown> = {};
  try {
    const body = (await response.json()) as { message?: string; data?: unknown };
    if (body.message) message = body.message;
    if (typeof body.data === "object" && body.data !== null) data = body.data as Record<string, unknown>;
  } catch {
    // Kein JSON - der Status reicht als Fallback.
  }
  throw new ApiHttpError(response.status, message, data);
};

export interface ApiAuthResponse {
  token: string;
  email: string;
}

const readAuthResponse = async (response: Response, fallbackEmail: string): Promise<ApiAuthResponse> => {
  await assertOk(response);
  const body = (await response.json()) as { token?: string; record?: { email?: string } };
  if (!body.token) throw new ApiHttpError(response.status, "Antwort ohne Token");
  return { token: body.token, email: body.record?.email || fallbackEmail };
};

export const loginWithPassword = async (identity: string, password: string): Promise<ApiAuthResponse> => {
  const response = await fetch(collectionUrl("users/auth-with-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity, password }),
  });
  return readAuthResponse(response, identity);
};

export const refreshAuth = async (token: string, email = ""): Promise<ApiAuthResponse> => {
  const response = await fetch(collectionUrl("users/auth-refresh"), {
    method: "POST",
    // PocketBase erwartet das Token ohne "Bearer".
    headers: { Authorization: token },
  });
  return readAuthResponse(response, email);
};

export interface ApiResultRecord {
  matchId: string;
  boardName: string;
  home: string;
  guest: string;
  legsHome: number;
  legsGuest: number;
  averageHome?: number;
  averageGuest?: number;
  highlights: string[];
  playedAt: string;
}

// Unique-Verstoß auf matchId: das Ergebnis liegt schon in der API, z.B.
// nach einem Retry, dessen erster Versuch doch durchgekommen war.
export const isDuplicateMatchError = (error: unknown): boolean =>
  error instanceof ApiHttpError &&
  error.status === 400 &&
  typeof error.data.matchId === "object" &&
  error.data.matchId !== null;

export const createResultRecord = async (token: string, record: ApiResultRecord): Promise<void> => {
  const response = await fetch(collectionUrl("results/records"), {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  await assertOk(response);
};

// Best effort: Fehler (auch Unique-Verstöße bei bekannten Namen) bleiben
// folgenlos, der Upload-Status hängt allein am Ergebnis.
export const addPlayersBestEffort = (token: string, names: string[]): Promise<unknown> =>
  Promise.allSettled(
    names
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) =>
        fetch(collectionUrl("players/records"), {
          method: "POST",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
      )
  );

export const readPlayersFromApi = async (token: string | null): Promise<string[]> => {
  const response = await fetch(`${collectionUrl("players/records")}?perPage=500&fields=name`, {
    headers: token ? { Authorization: token } : {},
  });
  await assertOk(response);
  const body = (await response.json()) as { items?: { name?: unknown }[] };
  return (body.items ?? [])
    .map((item) => item.name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .map((name) => name.trim());
};
