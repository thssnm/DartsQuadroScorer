import { vi } from "vitest";

// Gemeinsame Stubs für die Tests des API-Ziels. Keine echten Requests: jede
// Anfrage landet bei einem Handler, der anhand der URL entscheidet.

export const API_TOKEN_KEY = "darts-quadro-scorer:api-token";
export const API_EMAIL_KEY = "darts-quadro-scorer:api-email";

export const stubLocalStorage = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  return store;
};

export const loggedIn = (extra: Record<string, string> = {}) =>
  stubLocalStorage({ [API_TOKEN_KEY]: "old-token", [API_EMAIL_KEY]: "board@example.com", ...extra });

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export type FetchHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

export const gistOk: FetchHandler = () => json({ files: {} });

export const refreshOk: FetchHandler = () =>
  json({ token: "new-token", record: { email: "board@example.com" } });

export interface ApiHandlers {
  refresh?: FetchHandler;
  results?: FetchHandler;
  players?: FetchHandler;
}

// results/players ohne eigenen Handler antworten mit Erfolg.
export const apiRoutes = ({ refresh = refreshOk, results, players }: ApiHandlers = {}): FetchHandler =>
  (url, init) => {
    if (url.includes("/users/auth-refresh")) return refresh(url, init);
    if (url.includes("/results/records")) return results ? results(url, init) : json({ id: "r1" });
    if (url.includes("/players/records")) return players ? players(url, init) : json({ id: "p1" });
    throw new Error(`Unerwartete API-URL: ${url}`);
  };

export const stubFetch = (gist: FetchHandler, api: FetchHandler) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    return url.startsWith("https://api.github.com") ? gist(url, init) : api(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

export const callsTo = (fetchMock: ReturnType<typeof stubFetch>, part: string) =>
  (fetchMock.mock.calls as unknown as [string, RequestInit][]).filter(([url]) => String(url).includes(part));

export const bodyOf = (call: [string, RequestInit]): Record<string, unknown> =>
  JSON.parse(String(call[1].body)) as Record<string, unknown>;
