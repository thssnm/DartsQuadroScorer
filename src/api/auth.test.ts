import { afterEach, describe, expect, it, vi } from "vitest";
import { loginToApi, logoutFromApi, testApiConnection } from "./auth";
import { API_EMAIL_KEY, API_TOKEN_KEY, apiRoutes, bodyOf, gistOk, json, loggedIn, stubFetch, stubLocalStorage } from "./testHelpers";

const loginRoute = (url: string) => {
  if (!url.endsWith("/api/collections/users/auth-with-password")) throw new Error(url);
  return json({ token: "login-token", record: { email: "board@example.com" } });
};

describe("API login", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores token and e-mail but never the password", async () => {
    const store = stubLocalStorage();
    const fetchMock = stubFetch(gistOk, loginRoute);

    const result = await loginToApi(" board@example.com ", "geheim-123");

    expect(result.ok).toBe(true);
    expect(bodyOf(fetchMock.mock.calls[0] as unknown as [string, RequestInit])).toEqual({
      identity: "board@example.com",
      password: "geheim-123",
    });
    expect(store.get(API_TOKEN_KEY)).toBe("login-token");
    expect(store.get(API_EMAIL_KEY)).toBe("board@example.com");
    expect([...store.values()].some((value) => value.includes("geheim-123"))).toBe(false);
  });

  it("stores nothing when the credentials are rejected", async () => {
    const store = stubLocalStorage();
    stubFetch(gistOk, () => json({ code: 400, message: "Failed to authenticate.", data: {} }, 400));

    const result = await loginToApi("board@example.com", "falsch");

    expect(result).toMatchObject({ ok: false, message: "E-Mail oder Passwort falsch." });
    expect(store.size).toBe(0);
  });

  it("removes the token on logout", () => {
    const store = loggedIn();

    logoutFromApi();

    expect(store.get(API_TOKEN_KEY)).toBeUndefined();
  });
});

describe("API connection test", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the logged-in user and keeps the refreshed token", async () => {
    const store = loggedIn();
    stubFetch(gistOk, apiRoutes());

    expect(await testApiConnection()).toMatchObject({ ok: true, message: "Verbunden als board@example.com" });
    expect(store.get(API_TOKEN_KEY)).toBe("new-token");
  });

  it("reports an expired token", async () => {
    loggedIn();
    stubFetch(gistOk, apiRoutes({ refresh: () => json({ message: "unauthorized" }, 401) }));

    const result = await testApiConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });
});
