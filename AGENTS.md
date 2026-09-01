# AGENTS.md

Kontext für KI-Agenten, die an diesem Repo arbeiten.

## Projekt

**Landlines** (landlines.dev) — tägliches Logikrätsel im Browser. Eigene Mechanik namens *Grenzland*: Ein Raster wird vollständig in zusammenhängende Regionen aufgeteilt. Jede Region enthält genau ein Startfeld, dessen Zahl die Regionsgröße vorgibt. Randzahlen geben an, wie oft man beim Lesen einer kompletten Zeile bzw. Spalte eine Regionsgrenze überquert.

Regeln im Detail: `docs/mechanic.md`

## Stack

- React 18 + TypeScript (strict) + Vite
- pnpm
- Vitest (Unit), Playwright (E2E, optional)
- ESLint + Prettier
- Kein Backend. Persistenz über `localStorage` hinter einem `StorageAdapter`-Interface (`src/storage/`), damit später ein Pocketbase-Adapter ohne Umbau ergänzt werden kann.
- Kein CDN, keine externen Runtime-Requests, keine Telemetrie.

## Architektur

```
src/core/grenzland/   Solver + Generator, reines TypeScript ohne React
src/game/             Share-Grid, Spiellogik
src/storage/          StorageAdapter-Interface + LocalStorageAdapter
src/App.tsx           UI
```

`src/core/` darf **keine** React-Abhängigkeit haben.

---

## Arbeitsweise

### Antwortformat

- **Keine Fortschrittserzählung.** Kein "Ich analysiere jetzt...", "Ich habe festgestellt...", "Als nächstes werde ich...".
- Direkt arbeiten. Am Ende **maximal 10 Zeilen** Zusammenfassung:
  - geänderte Dateien
  - Testergebnis (`pnpm test`, `pnpm lint`, `pnpm build`)
  - offene Punkte oder Rückfragen
- Keine Wiederholung des Prompts, keine Bestätigungsfloskeln.
- Code nur zeigen, wenn danach gefragt wird oder es zur Klärung nötig ist.

### Scope

- **Nur die Dateien anfassen, die die Aufgabe erfordert.** Keine Aufräumarbeiten nebenbei, keine Umbenennungen, keine Formatierung fremder Dateien.
- Keine eigenmächtigen Produktentscheidungen. Wenn eine bessere Lösung auffällt: vorschlagen, nicht ausführen.
- Keine neuen Dependencies ohne Rückfrage.
- Keine neue Datei über 300 Zeilen. Bestehende Muster wiederverwenden statt neue einführen.

### Bei Änderungen an Mechanik, Solver oder Generator

**Erst analysieren, Ergebnis zeigen, auf Freigabe warten.** Dann implementieren. Nicht in einem Rutsch.

### Screenshots

Der Container hat keine Browser-Runtime. **Nicht versuchen, Chromium oder Systembibliotheken zu installieren.** Visuelle Prüfung ist Sache des Menschen. Falls ein Bild nötig ist: statisches SVG/HTML exportieren, das der Mensch selbst öffnen kann.

### Ehrlichkeit

Wenn eine Anforderung nicht erfüllbar ist oder ein Ergebnis nicht überzeugt: klar sagen. Nicht überspielen, keine erfundenen Zahlen.

---

## Nicht ändern ohne Rückfrage

- **Regionsfarben.** Geprüft gegen Deuteranopie, Protanopie und Tritanopie (minimaler Delta-E 42 über alle Paare und Sichtweisen). Jede Farbänderung invalidiert die Barrierefreiheit.
  ```
  A #0000fc   B #00e8d8   C #e40058   D #f8b800   E #940084
  leer #0a0a0c
  ```
- **Grau ist ausschließlich dem leeren Feld vorbehalten.** Keine Region darf grau sein.
- **Schwierigkeits-Gates.** Der Generator verwirft Puzzles, die ohne die Zieltechnik-Stufe lösbar sind. Diese Invariante ist der Kern der Schwierigkeitsklassifikation.
- **Backtracking/DFS ist nur für den Eindeutigkeitscheck erlaubt**, niemals als Grundlage des Ratings.
- **Share-Grid darf die Lösung nicht verraten.** Es kodiert Denkpausen pro Feld, nicht die Regionszugehörigkeit. Jede Änderung muss gegen die Regionsgrenzen auf Korrelation geprüft werden.

---

## Terminologie (sichtbare Texte)

| Verwenden | Nicht verwenden |
|---|---|
| Feld | Zelle |
| Startfeld | Anker |
| Region | Gebiet, Fläche |
| Randzahl | Grenzhinweis |

Interne Bezeichner im Code (`cell`, `cellPerformance`) bleiben englisch und unverändert.

## Modi

- **Daily**: genau ein Puzzle pro Tag, immer Schwierigkeit Medium, Seed aus dem **lokalen** Datum des Spielers (Wechsel um 00:00 Ortszeit). Keine Schwierigkeitsauswahl, kein Nachspielen vergangener Tage, kein Fehlerfeedback.
- **Endlos**: freie Schwierigkeitswahl, neues Puzzle jederzeit, Fehlerfeedback optional.

## Timer

Gemessen wird **aktive Spielzeit**, nicht Wall-Clock seit Start. Der Timer läuft nur bei `document.visibilityState === 'visible'` und nicht pausiert. Umsetzung über aufaddierte `Date.now()`-Differenzen, nicht über `setInterval`-Zähler (Throttling verfälscht sonst die Zeit).

Zurücksetzen leert das Brett, **nullt aber weder Timer noch `cellPerformance`** — sonst ließe sich die geteilte Zeit manipulieren.

## Fehlerhinweise

Bei vollständig gefülltem, aber falschem Brett wird **ein** verletzter Constraint auf **Regel-Ebene** angezeigt (Regionsgröße, Zusammenhang, Randzahl). Niemals auf Feld-Ebene.

*Der Spieler kann jeden dieser Verstöße selbst durch Nachzählen finden. Die App automatisiert Fleißarbeit, nicht Deduktion.*

## Typografie

Press Start 2P (SIL OFL), lokal unter `public/fonts`, kein CDN.

Nur auf: Titel, Startfeld-Labels, Randzahlen, Timer, Streak-Zahl.
Nicht auf: Tutorial, Buttons, Menüs, Fehlermeldungen, Share-Panel. Pixel-Fonts erhöhen die Lesezeit; das Tutorial braucht maximale Lesbarkeit.

Textfarbe wird **pro Region** gesetzt, nicht global — die Regionsfarben haben stark unterschiedliche Helligkeiten (L\* von 31.9 bis 83.3).

---

## Befehle

```bash
pnpm dev                  # Dev-Server, Port 8090
pnpm test                 # Vitest
pnpm lint
pnpm build
pnpm debug:difficulty     # Technik-Verteilung über 100 Puzzles pro Stufe
pnpm debug:share-grids    # Streuung und Spoiler-Korrelation der Share-Grids
```

Die Debug-Skripte sind die primäre Verifikation für Generator- und Share-Grid-Änderungen. **Nutze sie, statt Beispiele zu konstruieren.** Konstruierte Beispiele haben in der Vergangenheit falsche Schlüsse produziert.

## Nicht durchsuchen

```
node_modules/   dist/   build/   coverage/   .vite/   .debug/
*.map   .env*   public/fonts/   pnpm-lock.yaml
```

## Git

- Commits laufen unter `thssnm`. `user.name` und `user.email` sind lokal im Repo gesetzt — **nicht überschreiben**.
- Kein Force-Push auf `main`. Der Deploy-Hook von statichost.eu pullt von `main`; eine umgeschriebene Historie bricht den Build.
- Deploy: Push auf `main` triggert automatisch einen Build auf statichost.eu.
- Nach jedem abgeschlossenen Teilschritt committen. Kleine, nachvollziehbare Commits.
