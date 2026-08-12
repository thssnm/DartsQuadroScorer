# Darts Quadro Scorer

501-Scoring-App (Double Out), Eingabe passend zum Harrows Quadro Board
(x1/x2/x3/x4-Multiplikatoren, Bull 25/50).

## Installation (lokal starten)

Voraussetzung: Node.js (empfohlen: Version 20 oder neuer).

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
