# AGENTS.md

Kontext für KI-Agenten, die an diesem Repo arbeiten.

## Projekt

**Quadro Darts Scorer** (`darts-quadro-scorer`) — Scoring-App für 501 Double Out, gebaut für die Bedienung am Board auf Tablet/Handy. Die Eingabe ist auf das Harrows Quadro Board zugeschnitten: Multiplikatoren x1–x4 (Quadro = x4), Bull 25, Bull-Extra 50. Installierbar als PWA, läuft komplett ohne Backend.

Das Ergebnis eines beendeten Matches kann in ein GitHub Gist geschrieben werden, aus dem ein separates Dashboard-Projekt die Board-Ergebnisse liest.

Bedienung und Spielregeln aus Nutzersicht: `README.md`

## Stack

- React 19 + TypeScript (strict) + Vite 8
- npm (Lockfile: `package-lock.json`, festgeschrieben über `packageManager` in `package.json`)
- Vitest 4 für Unit-Tests, kein jsdom — Tests laufen in der Node-Umgebung
- oxlint (`.oxlintrc.json`), kein ESLint/Prettier
- PWA über `vite-plugin-pwa` (Konfiguration in `vite.config.ts`)
- Kein Backend. Persistenz über `localStorage` (`src/game/persistence.ts`). Einziger externer Request: die GitHub-Gist-API.

## Architektur

```
src/game/         Spiellogik: Reducer, Typen, Statistik, Persistenz — ohne React
src/gist/         GitHub-Gist-Anbindung: Upload, Spielernamen, Config
src/components/   UI-Komponenten
src/App.tsx       Komposition, Phasen-Routing, Effekte (Speichern, Upload)
src/App.css       Styles der gesamten App (eine Datei)
```

`src/game/` und `src/gist/` enthalten **kein** JSX und keine React-Imports.

### Zustand

Ein einziger `useReducer` in `App.tsx` hält den kompletten Spielzustand (`GameState`, `src/game/types.ts`). Jede Zustandsänderung ist eine Action in `gameReducer`. Lokaler `useState` nur für UI-Belange, die kein Spielzustand sind (Settings-Dialog, Gist-Status, Statistik-Ansicht).

Phasen: `setup` → `playing` → `leg-finished` / `match-finished`.

## Arbeitsweise

### Antwortformat

- **Keine Fortschrittserzählung.** Kein "Ich analysiere jetzt...", "Ich habe festgestellt...", "Als nächstes werde ich...".
- Direkt arbeiten. Am Ende **maximal 10 Zeilen** Zusammenfassung:
  - geänderte Dateien
  - Testergebnis (`npm test`, `npm run lint`, `npm run build`)
  - offene Punkte oder Rückfragen
- Keine Wiederholung des Prompts, keine Bestätigungsfloskeln.
- Code nur zeigen, wenn danach gefragt wird oder es zur Klärung nötig ist.

### Scope

- **Nur die Dateien anfassen, die die Aufgabe erfordert.** Keine Aufräumarbeiten nebenbei, keine Umbenennungen, keine Formatierung fremder Dateien.
- Keine eigenmächtigen Produktentscheidungen. Wenn eine bessere Lösung auffällt: vorschlagen, nicht ausführen.
- Keine neuen Dependencies ohne Rückfrage.
- Keine neue Datei über 300 Zeilen. Bestehende Muster wiederverwenden statt neue einführen.

### Bei Änderungen am Reducer

`gameReducer` ist der Kern der App. **Erst den betroffenen Case und seine Tests lesen, Analyse zeigen, auf Freigabe warten.** Dann implementieren. Nicht in einem Rutsch.

### Ehrlichkeit

Wenn eine Anforderung nicht erfüllbar ist oder ein Ergebnis nicht überzeugt: klar sagen. Nicht überspielen, keine erfundenen Zahlen.

---

## Nicht ändern ohne Rückfrage

Die folgenden Regeln sind in `gameReducer.test.ts` abgesichert. Wer sie ändert, ändert gezählte Ergebnisse — Averages, Best Leg, Highlights im Dashboard.

- **Double-Out und Bust.** Bust bei Rest < 0, Rest = 1, oder Rest = 0 ohne Double als letztem *tatsächlich eingegebenem* Dart (`evaluateTurn`). Maßgeblich ist `lastFilledSlotIndex`, nicht der dritte Slot — eine Aufnahme kann mit leeren Slots dahinter bestätigt werden.
- **Dart-Zählregel.** Nur eine Leg-gewinnende Aufnahme wird hinter dem entscheidenden Double abgeschnitten (`finalizedTurnDarts`). Jede andere Aufnahme zählt drei Darts, auch wenn leere Slots als Fehlwürfe bestätigt wurden. Davon hängen Average (Punkte / Darts × 3) und Best Leg ab.
- **Korrektur-Mechanismus.** `EDIT_TURN`/`CONFIRM_EDIT` bearbeitet eine Aufnahme des laufenden Legs und rechnet die Rest-Kette ab dort neu durch. Wird eine spätere Aufnahme dadurch rechnerisch unmöglich oder läge ein Leg-Sieg plötzlich an anderer Stelle, wird die gesamte Änderung verworfen und `editError` gesetzt — nie teilweise übernehmen.
- **Leg-Abschluss zurücknehmen.** `UNDO_LEG_RESULT` ("Rückgängig" im Leg-/Match-Ende-Popup) holt das letzte Leg bei **beiden** Spielern aus `legHistory` in die laufenden Aufnahmen zurück und senkt `legsWon`. Ein reines Zurücksetzen der Phase reicht nicht — die Aufnahmen wären sonst nicht mehr korrigierbar.
- **"Weiter" im Match-Ende-Popup ist endgültig.** Der Klick setzt `match-confirmed` im `localStorage`; danach führt die App auch nach einem Reload direkt zur Statistik, nicht zurück ins Popup. Sonst entstünde über "Rückgängig" eine Korrektur, deren Ergebnis als zweite Datei im Gist landet.
- **Ein Upload pro Match.** `uploadMatchResultOnce` setzt `match-uploaded` ausschließlich nach einem *erfolgreichen* Upload — ein fehlgeschlagener Versuch muss wiederholbar bleiben. Beide Merker verfallen mit dem Match (Phase `setup`).
- **Gist-Dateiformat.** `BoardGistFile` in `src/gist/api.ts` ist die Schnittstelle zum Dashboard: eine Datei `board-<Board>-<uuid>.json` pro beendetem Match mit `status: "finished"` und `acknowledged: false`, dazu die gemergte `players.json`. Feldnamen, `acknowledged`-Semantik und Dateinamensschema nur zusammen mit dem Dashboard ändern.
- **localStorage-Schlüssel.** Alle unter dem Präfix `darts-quadro-scorer:`. Ein umbenannter Schlüssel verliert den laufenden Spielstand auf den Boards.

## Tests

- `src/game/` und `src/gist/`: reine Unit-Tests gegen die Logik, Szenario-Stil wie in `gameReducer.test.ts`. Zustände über die vorhandenen Helfer (`playingState`, `withPlayer`, `setSlot`) aufbauen.
- Komponenten: kein DOM-Testing-Setup vorhanden. Gerendert wird mit `renderToStaticMarkup` aus `react-dom/server`, geprüft wird das Markup (siehe `ResultOverlay.test.tsx`, `App.test.tsx`).
- `window.localStorage` und `fetch` per `vi.stubGlobal` stubben, danach `vi.unstubAllGlobals()` im `afterEach` (siehe `persistence.test.ts`, `matchUpload.test.ts`). Es gibt keine echte `window`-Instanz in der Testumgebung.
- Keine Netzwerk-Requests in Tests. Der Gist-Upload wird ausschließlich über gestubbtes `fetch` getestet.

## Terminologie (sichtbare Texte, deutsch)

| Verwenden | Nicht verwenden |
|---|---|
| Aufnahme | Wurf, Runde |
| Dart | Pfeil |
| Rest | Restpunkte, Punktestand |
| Leg / Match | Satz, Spiel |
| Fehlwurf | Miss |
| Quadro (x4) | Vierfach |

Interne Bezeichner im Code (`turn`, `remaining`, `legsWon`) bleiben englisch und unverändert. Kommentare im Code sind deutsch und erklären das *Warum*, nicht das *Was*.

## Gist-Anbindung

- Token: `VITE_GITHUB_TOKEN` aus `.env` (Vorlage: `.env.example`), zur Buildzeit eingebettet. `.env` nicht committen.
- Gist-ID und Board-Name werden pro Gerät in den App-Einstellungen gesetzt und liegen im `localStorage`, nicht im Build.
- Ist der Upload abgeschaltet (Default) oder die Config unvollständig, läuft die App vollständig offline weiter — ein fehlender Token darf nie ein laufendes Spiel stören.

## Befehle

```bash
npm install                   # Lockfile ist package-lock.json
npm run dev                   # Vite Dev-Server
npm test                      # Vitest (einmaliger Lauf)
npm run lint                  # oxlint
npm run build                 # tsc -b && vite build
npm run preview               # Production-Build lokal servieren
```

Vor dem Abschluss einer Aufgabe müssen `npm test`, `npm run lint` und `npm run build` grün sein.

## Nicht durchsuchen

```
node_modules/   dist/   dev-dist/   build/   target/   screenshots/
package-lock.json   src/assets/Love-for-Darts-Logo.svg   .env*
```

## Git

- Commits laufen unter `thssnm`. `user.name` und `user.email` sind lokal im Repo gesetzt — **nicht überschreiben**.
- Remote: `thssnm/DartsQuadroScorer`. Kein Force-Push auf `main`.
- Deployment über Vercel, per GitHub-Integration verbunden: **jeder Push auf `main` löst automatisch einen Deploy aus**, ein manueller Schritt entfällt. `VITE_GITHUB_TOKEN` ist dort als Projekt-Umgebungsvariable hinterlegt (siehe README).
- Nach jedem abgeschlossenen Teilschritt committen. Kleine, nachvollziehbare Commits.
