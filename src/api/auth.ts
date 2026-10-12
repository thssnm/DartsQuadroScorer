import { clearApiAuth, loadApiAuth, saveApiAuth, type ApiAuth } from "../game/persistence";
import { loginWithPassword, refreshAuth } from "./client";
import { classifyApiUploadError, describeApiUploadFailure } from "./matchUpload";

export interface ApiAuthResult {
  ok: boolean;
  message: string;
  auth?: ApiAuth;
}

const failureMessage = (error: unknown): string => {
  const failure = classifyApiUploadError(error);
  if (failure.kind === "http" && (failure.status === 400 || failure.status === 401)) {
    return "E-Mail oder Passwort falsch.";
  }
  return describeApiUploadFailure(failure);
};

// Gespeichert werden nur Token und E-Mail - das Passwort verlässt diese
// Funktion nicht.
export const loginToApi = async (email: string, password: string): Promise<ApiAuthResult> => {
  try {
    const auth = await loginWithPassword(email.trim(), password);
    saveApiAuth(auth);
    return { ok: true, message: `Angemeldet als ${auth.email}`, auth };
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
};

export const logoutFromApi = (): void => clearApiAuth();

export const testApiConnection = async (): Promise<ApiAuthResult> => {
  const stored = loadApiAuth();
  if (!stored) return { ok: false, message: "Nicht angemeldet." };
  try {
    const auth = await refreshAuth(stored.token, stored.email);
    saveApiAuth(auth);
    return { ok: true, message: `Verbunden als ${auth.email}`, auth };
  } catch (error) {
    return { ok: false, message: describeApiUploadFailure(classifyApiUploadError(error)) };
  }
};
