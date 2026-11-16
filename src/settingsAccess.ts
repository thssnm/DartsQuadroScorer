// Das Einstellungsfenster (und damit der Login) ist nur erreichbar, wenn die
// Seite mit dem Parameter "?settings" aufgerufen wird. Ohne ihn gibt es im
// UI keinen Weg zum Login - niemand kann am Board beliebige Zugangsdaten
// eintippen. Die gespeicherte Anmeldung bleibt davon unberührt. Das ist
// kein Schutz der API, nur das Wegnehmen der sichtbaren Einladung.
export const SETTINGS_PARAM = "settings";

export const hasSettingsAccess = (search: string = window.location?.search ?? ""): boolean => {
  try {
    return new URLSearchParams(search).has(SETTINGS_PARAM);
  } catch {
    return false;
  }
};
