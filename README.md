# Quadro Darts Scorer

501-Scoring-App (Double Out), Eingabe passend zum Harrows Quadro Board
(x1/x2/x3/x4-Multiplikatoren, Bull 25/50).

## Installation (lokal starten)

Voraussetzung: Node.js (empfohlen: Version 20 oder neuer).

Für den Gist-Upload lokal eine `.env` nach Vorlage von `.env.example` anlegen:

```bash
VITE_GITHUB_TOKEN=
```

Die `.env` nicht committen. Beim Vercel-Deploy denselben Wert als
Projekt-Umgebungsvariable in den Vercel-Projekteinstellungen hinterlegen. Die
Gist-ID wird in den App-Einstellungen am Board eingetragen.

Optional lässt sich mit `VITE_POCKETBASE_URL` ein anderer Server für das
API-Ziel setzen (Default: `https://api.thssn.dev`).

```bash
npm install
npm run dev
```

Danach im Browser die angezeigte Adresse öffnen (meist `http://localhost:5173`).

## Als PWA installieren

1. Production-Build erstellen:
   ```bash
   npm run build
   npm run preview
   ```
2. Die Preview-Adresse (z. B. `http://localhost:4173`) auf dem Handy/Tablet
   im Browser öffnen (Gerät muss im selben Netzwerk sein, ggf. `--host` an
   `npm run preview` anhängen, damit es im LAN erreichbar ist).
3. Im Browser-Menü "Zum Startbildschirm hinzufügen" bzw. "App installieren"
   wählen.

Für dauerhaften Betrieb (z. B. am Board) empfiehlt sich, den `dist`-Ordner
auf einem kleinen Server (z. B. im Homelab) zu hosten und dort per PWA zu
installieren, statt jedes Mal `npm run dev` zu starten.

## Bedienung

- **Setup:** Spielernamen eintragen, Anzahl Legs wählen (Best of 1/3/5/7),
  mit dem Switch-Button den Startspieler festlegen.
- **Eingabe:** Zahl 1–20 antippen für einfachen Wert. Vorher x2/x3/x4
  aktivieren für Double/Triple/Quadro. 25 = Bull, mit aktivem x2 = Bull-Extra
  (50). 0 = Fehlwurf.
- **BUST:** Verwirft die aktuelle Aufnahme, der Punktestand bleibt
  unverändert, der Spieler wechselt. Nutzen, falls ein Bust manuell
  markiert werden muss.
- **Häkchen:** Bestätigt die Aufnahme. Die App prüft automatisch auf
  Bust nach Double-Out-Regeln (Rest < 0, Rest = 1, oder Rest = 0 ohne
  Double als letzten Dart).
- **Rücktaste:** Letzten eingegebenen Dart der aktuellen Aufnahme löschen.

## Ergebnis-Upload (Gist und API)

Ein bestätigtes Match ("Weiter zur Statistik") wird parallel an zwei Ziele
geschickt, wenn in den Einstellungen "Ergebnis-Upload aktivieren" an ist:

- **Gist:** wie bisher, für das Dashboard.
- **API (PocketBase):** zusätzlich, nur wenn das Board im Bereich "API" der
  Einstellungen angemeldet ist (E-Mail + Passwort, gespeichert wird nur das
  Token). Ohne Anmeldung wird die API still übersprungen.

"Neues Match" bleibt gesperrt, bis beide Ziele fertig sind. Schlägt ein Ziel
fehl, erscheint das Fehler-Popup; "Upload erneut versuchen" wiederholt nur das
fehlgeschlagene Ziel. Ein fehlgeschlagener Upload wird beim nächsten Start
der App erneut versucht.

In der Match-Historie (☰) steht pro Match der Status für Gist und API; beide
lassen sich dort nachträglich hochladen ("Upload" bzw. "Upload zur API").
Die Spieler-Auswahl im Setup lädt Namen aus beiden Quellen.

## Livescore

Mit "Livescore senden" (Einstellungen, Default aus) schickt das Tablet den
laufenden Spielstand an die PocketBase-Collection `livescore`, aus der ein
separater Ticker liest. Der Schalter ist nur nach der API-Anmeldung bedienbar.

- Gesendet wird bei jeder Änderung des Spielstands: ab Matchstart (501:501),
  nach jeder Aufnahme, Korrektur, "Rückgängig" und Legwechsel.
- Status `live` bis "Weiter zur Statistik", danach `finished`. "Spiel
  abbrechen" setzt ebenfalls `finished`.
- Der Sender ist ein reiner Beobachter: er blockiert nie, zeigt im Spiel
  nichts an und berührt weder Spiellogik noch Ergebnis-Upload. Fehler
  erscheinen nur als Statuszeile in den Einstellungen; der nächste
  Spielstand wird automatisch erneut versucht.
- Das Ergebnis eines live gesendeten Matches bekommt in der API dieselbe
  `matchId` wie sein Livescore-Eintrag.

## Spielregeln (implementiert)

- Start bei 501 Punkten, Double Out.
- Bust bei: Unterschreiten von 0, Rest genau 1, oder Rest 0 ohne
  Double-Finish.
- Legs werden automatisch gezählt, Startspieler wechselt nach jedem Leg.
- Match endet, sobald ein Spieler die nötige Anzahl Legs erreicht hat.

## Nicht enthalten (mögliche Erweiterungen)

- Undo über die aktuelle Aufnahme hinaus (nur der laufende Wurf ist
  korrigierbar).
- Checkout-Vorschläge.
- Speicherung/Historie über die laufende Session hinaus.
- Direkte Hardware-Anbindung ans Quadro Board (Eingabe ist manuell/touch).
