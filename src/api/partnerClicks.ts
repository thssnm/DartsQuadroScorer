import { POCKETBASE_URL } from "./client";

// UTM-Parameter: Love for Darts sieht die Klicks aus der App in der eigenen
// Webanalyse, ohne dass hier etwas erfasst wird.
export const PARTNER_URL = "https://lovefordarts.de/?utm_source=quadro-scorer&utm_medium=app&utm_campaign=partner";

const BOARD_NAME_MAX = 100;

// Eigener Zähler: ein Eintrag pro Klick in der Collection partner_clicks,
// nur mit Board-Name (Zeitpunkt setzt PocketBase über "created"). Ohne
// Token - Besucher sind nicht angemeldet, die Collection erlaubt das
// öffentliche Anlegen. Best effort: wirft nie und hält den Link nicht auf;
// offline geht der Klick einfach verloren.
export const countPartnerClick = (boardName: string): void => {
  try {
    void fetch(`${POCKETBASE_URL}/api/collections/partner_clicks/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardName: boardName.trim().slice(0, BOARD_NAME_MAX) }),
      // Der Request soll auch durchgehen, wenn der Browser die Seite verlässt.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fetch fehlt oder wirft synchron - der Klick zählt dann eben nicht.
  }
};
