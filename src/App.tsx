import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createInitialState, gameReducer } from "./game/gameReducer";
import {
  loadGameState,
  saveGameState,
  clearGameState,
  isResumableState,
  loadBoardId,
  loadGistId,
  loadResultUploadEnabled,
  saveBoardId,
  saveGistId,
  saveResultUploadEnabled,
  loadMatchConfirmed,
  saveMatchConfirmed,
  saveMatchUploaded,
  saveMatchUploadedApi,
  loadApiAuth,
  loadLiveScoreEnabled,
  saveLiveScoreEnabled,
  loadMatchHistory,
  saveCurrentMatchHistoryId,
  type MatchHistoryEntry,
} from "./game/persistence";
import { SetupScreen } from "./components/SetupScreen";
import { Scoreboard } from "./components/Scoreboard";
import { DartInput } from "./components/DartInput";
import { MatchStats } from "./components/MatchStats";
import { SettingsModal, type Settings } from "./components/SettingsModal";
import { MatchHistoryModal } from "./components/MatchHistoryModal";
import { ResultOverlay } from "./components/ResultOverlay";
import { UploadErrorPopup } from "./components/UploadErrorPopup";
import { loadGistConfig } from "./gist/config";
import { testGistConnection } from "./gist/api";
import { describeUploadFailure } from "./gist/matchUpload";
import { recordFinishedMatch, setMatchHistoryStatus, uploadHistoryEntry } from "./gist/matchHistory";
import { loginToApi, logoutFromApi, testApiConnection } from "./api/auth";
import { describeApiUploadFailure, ensureApiHistoryFields, uploadHistoryEntryToApi } from "./api/matchUpload";
import {
  IDLE_TARGETS_STATE,
  PENDING_TARGETS_STATE,
  UPLOAD_TARGETS,
  acknowledgeUploadFailures,
  applyTargetState,
  failedTargets,
  isNewMatchLockedForTargets,
  isUploadPopupVisible,
  isUploadRetrying,
  runMatchUploadTargets,
  type UploadTarget,
  type UploadTargetsState,
} from "./api/uploadTargets";
import { useLiveScore } from "./live/useLiveScore";
import { describeLiveSendStatus } from "./live/sender";
import type { GameState } from "./game/types";
import "./App.css";

const hasMatchInput = (state: GameState): boolean =>
  state.players.some(
    (player) => player.turns.length > 0 || player.legHistory.some((leg) => leg.turns.length > 0)
  ) || state.currentSlots.some((slot) => slot.segment !== null || slot.multiplier !== 1);

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    const saved = loadGameState();
    if (saved && isResumableState(saved)) return saved;
    return createInitialState("Heim", "Gast", 2);
  });
  // Ein mit "Weiter" bestätigtes Match bleibt bestätigt - nach einem Reload
  // geht es direkt zur Statistik, nicht zurück ins Match-Ende-Popup.
  const [showMatchStats, setShowMatchStats] = useState(() => loadMatchConfirmed());
  const [boardId, setBoardId] = useState(() => loadBoardId());
  const [gistId, setGistId] = useState(() => loadGistId());
  const [resultUploadEnabled, setResultUploadEnabled] = useState(() => loadResultUploadEnabled());
  const [apiAuth, setApiAuth] = useState(() => loadApiAuth());
  const [liveScoreEnabled, setLiveScoreEnabled] = useState(() => loadLiveScoreEnabled());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  // ID des Historie-Eintrags zum laufenden Match, um dessen Status nach dem
  // Upload-Versuch nachzuziehen.
  const historyEntryId = useRef<string | null>(null);
  const [gistStatus, setGistStatus] = useState<string | null>(null);
  // Zustand beider Upload-Ziele (Gist, API) für das bestätigte Match. "Neues
  // Match" bleibt gesperrt, solange eines davon "pending" oder "failed" ist -
  // erst Erfolg, Überspringen oder ein quittierter Fehler gibt den Button
  // frei. Ein schon bestätigtes Match startet nach einem Reload direkt in
  // "pending", damit der Button nicht für einen Frame klickbar ist.
  const [uploadState, setUploadState] = useState<UploadTargetsState>(() =>
    loadMatchConfirmed() && state.phase === "match-finished" ? PENDING_TARGETS_STATE : IDLE_TARGETS_STATE
  );
  // Der Button hängt am Zustand der Upload-Promises, nicht an einer Dauer.
  const newMatchLocked = isNewMatchLockedForTargets(uploadState);
  const matchFinished = state.phase === "match-finished";
  // Das Match gilt erst als abgeschlossen, wenn der Nutzer das Match-Ende-
  // Popup mit "Weiter" bestätigt hat - vorher kann er es noch zurücknehmen.
  const matchConfirmed = matchFinished && showMatchStats;
  // Beim Start bewusst false: ist ein bereits bestätigtes Match noch nicht
  // hochgeladen (fehlgeschlagener Versuch), bekommt es nach einem Reload
  // eine neue Chance. Doppelte Uploads verhindert uploadMatchResultOnce.
  const previousMatchConfirmed = useRef(false);

  // Läuft ein Spiel (nicht mehr im Setup), wird jede Änderung sofort
  // gespeichert - so übersteht der Spielstand einen Reload oder das
  // Schließen der App. Landet die Phase wieder bei "setup" (z.B. nach
  // Abbrechen oder Reset), wird der gespeicherte Stand gelöscht.
  useEffect(() => {
    if (state.phase === "setup") {
      clearGameState();
      // Beide Merker gehören zum gespeicherten Match - mit dem Match
      // verfallen sie, damit das nächste Ergebnis wieder hochgeladen wird.
      saveMatchConfirmed(false);
      saveMatchUploaded(false);
      saveMatchUploadedApi(false);
      // Der Eintrag selbst bleibt in der Historie, nur die Zuordnung zum
      // laufenden Match verfällt.
      saveCurrentMatchHistoryId(null);
      historyEntryId.current = null;
    } else {
      saveGameState(state);
    }
  }, [state]);

  // Ein Upload-Versuch mit den Daten des laufenden Matches - sowohl der
  // automatische nach dem Bestätigen als auch jeder Klick auf "Upload erneut
  // versuchen". Wiederholt wird nur der Request, der Match-Zustand bleibt -
  // und nur für die übergebenen Ziele.
  const runMatchUpload = useCallback((targets: UploadTarget[]) => {
    if (targets.includes("gist")) setGistStatus("Ergebnis wird hochgeladen …");
    void runMatchUploadTargets(
      targets,
      {
        enabled: resultUploadEnabled,
        gistConfig: loadGistConfig(gistId),
        boardId,
        state,
        historyEntryId: historyEntryId.current,
      },
      (target, next) => {
        setUploadState((previous) => applyTargetState(previous, target, next));
        // Status, Toast und Historie des API-Ziels pflegt dessen Modul.
        if (target === "api") {
          // Ein Refresh kann ein neues Token gespeichert haben.
          if (next.phase !== "pending") setApiAuth(loadApiAuth());
          return;
        }
        if (next.phase === "failed") setGistStatus(null);
        // "done" bei abgeschaltetem Upload heißt "übersprungen": weder eine
        // Erfolgsmeldung noch ein Statuswechsel in der Historie.
        if (next.phase === "done") {
          setGistStatus(resultUploadEnabled ? "Ergebnis in Gist hochgeladen." : null);
          if (resultUploadEnabled && historyEntryId.current) {
            setMatchHistoryStatus(historyEntryId.current, "uploaded");
          }
        }
      }
    );
  }, [boardId, gistId, resultUploadEnabled, state]);

  // Hochgeladen wird erst nach dem Bestätigen des Match-Ende-Popups: ein
  // über "Rückgängig" zurückgenommenes Match darf nicht im Turniersystem
  // landen. Dass dabei pro Match nur ein einziger erfolgreicher Upload
  // herauskommt - auch wenn das Popup nach einem Reload erneut bestätigt
  // wird - stellt uploadMatchResultOnce sicher.
  useEffect(() => {
    const changedToMatchConfirmed = !previousMatchConfirmed.current && matchConfirmed;
    previousMatchConfirmed.current = matchConfirmed;

    if (!changedToMatchConfirmed) return;

    // Lokale Kopie des Ergebnisses - unabhängig vom Upload-Schalter und vom
    // Ausgang des Uploads. Ein zweiter Durchlauf (Reload) legt keinen
    // weiteren Eintrag an.
    historyEntryId.current = recordFinishedMatch(state, boardId, resultUploadEnabled);
    // matchId und API-Status einmalig am Eintrag festhalten; ein Reload
    // behält beides.
    ensureApiHistoryFields(
      historyEntryId.current,
      !resultUploadEnabled ? "upload-disabled" : loadApiAuth() ? "not-uploaded" : "not-logged-in"
    );
    runMatchUpload(UPLOAD_TARGETS);
  }, [boardId, matchConfirmed, resultUploadEnabled, runMatchUpload, state]);

  // Livescore: reiner Beobachter, nach dem Upload-Effekt aufgerufen, damit
  // der Ergebnis-Upload die liveMatchId sicher noch vorfindet.
  const liveScoreStatus = useLiveScore({
    state,
    matchConfirmed,
    boardId,
    enabled: liveScoreEnabled,
    token: apiAuth ? apiAuth.token : null,
  });

  // Die Einstellungen werden erst beim Klick auf "Speichern" übernommen,
  // nicht mehr bei jedem Tastendruck.
  const saveSettings = (settings: Settings) => {
    setBoardId(settings.boardId);
    saveBoardId(settings.boardId);
    setGistId(settings.gistId);
    saveGistId(settings.gistId);
    setResultUploadEnabled(settings.resultUploadEnabled);
    saveResultUploadEnabled(settings.resultUploadEnabled);
    setLiveScoreEnabled(settings.liveScoreEnabled);
    saveLiveScoreEnabled(settings.liveScoreEnabled);
  };

  const settingsButton = (
    <button
      type="button"
      className="settings-btn"
      onClick={() => setSettingsOpen(true)}
      aria-label="Einstellungen öffnen"
      title="Einstellungen"
    >
      ⚙
    </button>
  );

  // Historie und Versionsnummer nur im Startbildschirm: während des Spiels
  // soll die Ecke über dem Scoreboard so leer wie möglich bleiben.
  const setupCornerButtons = (
    <>
      {settingsButton}
      <button
        type="button"
        className="settings-btn"
        onClick={() => {
          setHistory(loadMatchHistory());
          setHistoryOpen(true);
        }}
        aria-label="Match-Historie öffnen"
        title="Match-Historie"
      >
        ☰
      </button>
      <span className="app__version">v{__APP_VERSION__}</span>
    </>
  );

  const settingsModal = settingsOpen ? (
    <SettingsModal
      boardId={boardId}
      gistId={gistId}
      resultUploadEnabled={resultUploadEnabled}
      liveScoreEnabled={liveScoreEnabled}
      liveScoreStatus={describeLiveSendStatus(liveScoreStatus)}
      onSave={saveSettings}
      onTestConnection={(testGistId) =>
        testGistConnection(loadGistConfig(testGistId)).then((result) =>
          result.ok ? `✓ ${result.message}` : `Verbindung fehlgeschlagen: ${result.message}`
        )
      }
      apiEmail={apiAuth ? apiAuth.email : null}
      onApiLogin={(email, password) =>
        loginToApi(email, password).then((result) => {
          setApiAuth(loadApiAuth());
          return result;
        })
      }
      onApiLogout={() => {
        logoutFromApi();
        setApiAuth(null);
      }}
      onApiTest={() =>
        testApiConnection().then((result) => {
          setApiAuth(loadApiAuth());
          return result.ok ? `✓ ${result.message}` : `Verbindung fehlgeschlagen: ${result.message}`;
        })
      }
      onClose={() => setSettingsOpen(false)}
    />
  ) : null;

  // Während eines Wiederholungsversuchs bleibt das Popup stehen (Phase
  // "pending" bei bereits bekanntem Fehler), damit der Nutzer sieht, dass
  // etwas passiert.
  const uploadPopupVisible = isUploadPopupVisible(uploadState);
  const uploadFailedTargets = failedTargets(uploadState);
  const historyModal = historyOpen ? (
    <MatchHistoryModal
      entries={history}
      onClose={() => setHistoryOpen(false)}
      onUpload={(entry) =>
        uploadHistoryEntry(entry, loadGistConfig(gistId)).then((outcome) => {
          // Status aus dem localStorage nachladen, damit die Liste genau das
          // zeigt, was tatsächlich gespeichert wurde.
          setHistory(loadMatchHistory());
          return outcome.uploaded;
        })
      }
      apiLoggedIn={apiAuth !== null}
      onApiUpload={(entry) =>
        uploadHistoryEntryToApi(entry).then((outcome) => {
          setHistory(loadMatchHistory());
          setApiAuth(loadApiAuth());
          return outcome.uploaded;
        })
      }
    />
  ) : null;

  const uploadErrorPopup = uploadPopupVisible ? (
    <UploadErrorPopup
      onRetry={() => runMatchUpload(uploadFailedTargets)}
      onConfirm={() => setUploadState(acknowledgeUploadFailures)}
      retrying={isUploadRetrying(uploadState)}
      failedTargets={uploadFailedTargets}
      detail={
        [
          uploadState.gist.failure ? describeUploadFailure(uploadState.gist.failure) : null,
          uploadState.api.failure ? describeApiUploadFailure(uploadState.api.failure) : null,
        ]
          .filter(Boolean)
          .join(" ") || null
      }
    />
  ) : null;

  if (state.phase === "setup") {
    return (
      <>
        <div className="app__floating-settings">{setupCornerButtons}</div>
        <SetupScreen
          resultUploadEnabled={resultUploadEnabled}
          gistConfig={loadGistConfig(gistId)}
          onStart={(nameA, nameB, legsToWin) => {
            setShowMatchStats(false);
            setGistStatus(null);
            setUploadState(IDLE_TARGETS_STATE);
            dispatch({ type: "RESET_MATCH", nameA, nameB, legsToWin });
            dispatch({ type: "START_MATCH" });
          }}
        />
        {settingsModal}
        {historyModal}
        {uploadErrorPopup}
      </>
    );
  }

  if (matchFinished && showMatchStats) {
    return (
      <>
        <div className="app__floating-settings">{settingsButton}</div>
        <MatchStats
          state={state}
          gistStatus={gistStatus}
          newMatchDisabled={newMatchLocked}
          onNewMatch={() => {
            // Zweite Absicherung neben disabled und dem Guard in MatchStats.
            if (newMatchLocked) return;
            setShowMatchStats(false);
            setGistStatus(null);
            setUploadState(IDLE_TARGETS_STATE);
            dispatch({
              type: "RESET_MATCH",
              nameA: state.players[0].name,
              nameB: state.players[1].name,
              legsToWin: state.legsToWin,
            });
          }}
        />
        {settingsModal}
        {historyModal}
        {uploadErrorPopup}
      </>
    );
  }

  const lastThrowerIdx: 0 | 1 = state.activePlayer === 0 ? 1 : 0;
  const canUndo = state.players[lastThrowerIdx].turns.length > 0 && !state.editingTurn;
  const canSwitchStartingPlayer = state.phase === "playing" && !state.editingTurn && !hasMatchInput(state);

  // Beim Bearbeiten einer bereits bestätigten Aufnahme muss die Live-
  // Vorschau (Double-Finish-Erkennung) auf dem Punktestand VOR dieser
  // Aufnahme rechnen, nicht auf dem aktuellen Gesamtrest des Spielers.
  const remainingForInput = state.editingTurn
    ? state.players[state.editingTurn.playerIndex].turns[state.editingTurn.turnIndex]?.scoreBefore ??
      state.players[state.activePlayer].remaining
    : state.players[state.activePlayer].remaining;

  const legWinnerForOverlay =
    state.phase === "leg-finished"
      ? state.players[0].remaining === 0
        ? state.players[0]
        : state.players[1]
      : null;

  const matchWinnerForOverlay =
    matchFinished
      ? state.players[0].legsWon > state.players[1].legsWon
        ? state.players[0]
        : state.players[1]
      : null;

  const legsSummary = `Legs: ${state.players[0].name} ${state.players[0].legsWon} : ${state.players[1].legsWon} ${state.players[1].name}`;

  return (
    <>
      <div className="app__floating-settings">{settingsButton}</div>
      <div className="app">
        <Scoreboard
          state={state}
          onEditTurn={(playerIndex, turnIndex) => dispatch({ type: "EDIT_TURN", playerIndex, turnIndex })}
        />
        <DartInput
          slots={state.currentSlots}
          remaining={remainingForInput}
          onSetSegment={(index, segment) => dispatch({ type: "SET_SLOT_SEGMENT", index, segment })}
          onSetMultiplier={(index, multiplier) =>
            dispatch({ type: "SET_SLOT_MULTIPLIER", index, multiplier })
          }
          onClearSlot={(index) => dispatch({ type: "CLEAR_SLOT", index })}
          onConfirmTurn={() => dispatch({ type: state.editingTurn ? "CONFIRM_EDIT" : "CONFIRM_TURN" })}
          onUndo={() => dispatch({ type: "UNDO_LAST_TURN" })}
          onAbort={() => {
            if (window.confirm("Spiel wirklich abbrechen und neu starten?")) {
              dispatch({ type: "ABORT_MATCH" });
            }
          }}
          canUndo={canUndo}
          isEditing={!!state.editingTurn}
          onCancelEdit={() => dispatch({ type: "CANCEL_EDIT" })}
          canSwitchStartingPlayer={canSwitchStartingPlayer}
          onSwitchStartingPlayer={() => dispatch({ type: "SWITCH_STARTING_PLAYER" })}
        />

        {legWinnerForOverlay && (
          <ResultOverlay
            title={`${legWinnerForOverlay.name} gewinnt das Leg!`}
            summary={legsSummary}
            confirmLabel="Nächstes Leg"
            onConfirm={() => dispatch({ type: "NEXT_LEG" })}
            onUndo={() => dispatch({ type: "UNDO_LEG_RESULT" })}
          />
        )}

        {matchWinnerForOverlay && (
          <ResultOverlay
            title={`${matchWinnerForOverlay.name} gewinnt das Match!`}
            summary={legsSummary}
            confirmLabel="Weiter zur Statistik"
            onConfirm={() => {
              // Endgültiger Abschluss: ab hier gibt es kein "Rückgängig"
              // mehr, auch nicht über einen Reload.
              saveMatchConfirmed(true);
              setShowMatchStats(true);
            }}
            onUndo={() => dispatch({ type: "UNDO_LEG_RESULT" })}
          />
        )}

        {gistStatus && !matchWinnerForOverlay && <div className="gist-toast">{gistStatus}</div>}

        {state.editError && (
          <div className="leg-overlay">
            <div className="leg-overlay__card">
              <h1>Ungültiger Wert</h1>
              <p>{state.editError}</p>
              <button onClick={() => dispatch({ type: "DISMISS_EDIT_ERROR" })}>Verstanden</button>
            </div>
          </div>
        )}
      </div>
      {settingsModal}
      {historyModal}
      {uploadErrorPopup}
    </>
  );
}

export default App;
