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
} from "./game/persistence";
import { SetupScreen } from "./components/SetupScreen";
import { Scoreboard } from "./components/Scoreboard";
import { DartInput } from "./components/DartInput";
import { MatchStats } from "./components/MatchStats";
import { SettingsModal, type Settings } from "./components/SettingsModal";
import { ResultOverlay } from "./components/ResultOverlay";
import { UploadErrorPopup } from "./components/UploadErrorPopup";
import { loadGistConfig } from "./gist/config";
import { testGistConnection } from "./gist/api";
import { describeUploadFailure } from "./gist/matchUpload";
import {
  IDLE_UPLOAD_STATE,
  isNewMatchLocked,
  runUploadFlow,
  type UploadFlowState,
} from "./gist/uploadFlow";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gistStatus, setGistStatus] = useState<string | null>(null);
  // Zustand des Gist-Uploads für das bestätigte Match. "Neues Match" bleibt
  // gesperrt, solange er "pending" oder "failed" ist - erst ein Erfolg oder
  // ein quittierter Fehler gibt den Button frei. Ein schon bestätigtes Match
  // startet nach einem Reload direkt in "pending", damit der Button nicht für
  // einen Frame klickbar ist.
  const [uploadState, setUploadState] = useState<UploadFlowState>(() =>
    loadMatchConfirmed() && state.phase === "match-finished"
      ? { phase: "pending", failure: null }
      : IDLE_UPLOAD_STATE
  );
  const { phase: uploadPhase, failure: uploadFailure } = uploadState;
  // Der Button hängt am Zustand des Upload-Promise, nicht an einer Dauer.
  const newMatchLocked = isNewMatchLocked(uploadState);
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
    } else {
      saveGameState(state);
    }
  }, [state]);

  // Ein Upload-Versuch mit den Daten des laufenden Matches - sowohl der
  // automatische nach dem Bestätigen als auch jeder Klick auf "Upload erneut
  // versuchen". Wiederholt wird nur der Request, der Match-Zustand bleibt.
  const runMatchUpload = useCallback(() => {
    setGistStatus("Ergebnis wird hochgeladen …");
    void runUploadFlow(
      {
        enabled: resultUploadEnabled,
        config: loadGistConfig(gistId),
        boardId,
        state,
      },
      (next) => {
        // Beim Wiederholen bleibt der bekannte Fehler stehen, damit das
        // Popup während des neuen Versuchs nicht kurz verschwindet.
        setUploadState((previous) =>
          next.phase === "pending" ? { phase: "pending", failure: previous.failure } : next
        );
        if (next.phase === "done") setGistStatus("Ergebnis in Gist hochgeladen.");
        if (next.phase === "failed") setGistStatus(null);
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

    runMatchUpload();
  }, [matchConfirmed, runMatchUpload]);

  // Die Einstellungen werden erst beim Klick auf "Speichern" übernommen,
  // nicht mehr bei jedem Tastendruck.
  const saveSettings = (settings: Settings) => {
    setBoardId(settings.boardId);
    saveBoardId(settings.boardId);
    setGistId(settings.gistId);
    saveGistId(settings.gistId);
    setResultUploadEnabled(settings.resultUploadEnabled);
    saveResultUploadEnabled(settings.resultUploadEnabled);
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

  const settingsModal = settingsOpen ? (
    <SettingsModal
      boardId={boardId}
      gistId={gistId}
      resultUploadEnabled={resultUploadEnabled}
      onSave={saveSettings}
      onTestConnection={(testGistId) =>
        testGistConnection(loadGistConfig(testGistId)).then((result) =>
          result.ok ? `✓ ${result.message}` : `Verbindung fehlgeschlagen: ${result.message}`
        )
      }
      onClose={() => setSettingsOpen(false)}
    />
  ) : null;

  // Während eines Wiederholungsversuchs bleibt das Popup stehen (Phase
  // "pending" bei bereits bekanntem Fehler), damit der Nutzer sieht, dass
  // etwas passiert.
  const uploadPopupVisible =
    uploadPhase === "failed" || (uploadPhase === "pending" && uploadFailure !== null);
  const uploadErrorPopup = uploadPopupVisible ? (
    <UploadErrorPopup
      onRetry={runMatchUpload}
      onConfirm={() => setUploadState({ phase: "acknowledged", failure: null })}
      retrying={uploadPhase === "pending"}
      detail={uploadFailure ? describeUploadFailure(uploadFailure) : null}
    />
  ) : null;

  if (state.phase === "setup") {
    return (
      <>
        <div className="app__floating-settings">{settingsButton}</div>
        <SetupScreen
          resultUploadEnabled={resultUploadEnabled}
          gistConfig={loadGistConfig(gistId)}
          onStart={(nameA, nameB, legsToWin) => {
            setShowMatchStats(false);
            setGistStatus(null);
            setUploadState(IDLE_UPLOAD_STATE);
            dispatch({ type: "RESET_MATCH", nameA, nameB, legsToWin });
            dispatch({ type: "START_MATCH" });
          }}
        />
        {settingsModal}
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
            setUploadState(IDLE_UPLOAD_STATE);
            dispatch({
              type: "RESET_MATCH",
              nameA: state.players[0].name,
              nameB: state.players[1].name,
              legsToWin: state.legsToWin,
            });
          }}
        />
        {settingsModal}
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
      {uploadErrorPopup}
    </>
  );
}

export default App;
