import { useEffect, useReducer, useRef, useState } from "react";
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
} from "./game/persistence";
import { SetupScreen } from "./components/SetupScreen";
import { Scoreboard } from "./components/Scoreboard";
import { DartInput } from "./components/DartInput";
import { MatchStats } from "./components/MatchStats";
import { SettingsModal } from "./components/SettingsModal";
import { UploadErrorPopup } from "./components/UploadErrorPopup";
import { loadGistConfig } from "./gist/config";
import { testGistConnection } from "./gist/api";
import { uploadMatchResult } from "./gist/matchUpload";
import "./App.css";

const MATCH_OVERLAY_DURATION_MS = 2500;

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    const saved = loadGameState();
    if (saved && isResumableState(saved)) return saved;
    return createInitialState("Heim", "Gast", 2);
  });
  const [showMatchStats, setShowMatchStats] = useState(false);
  const [boardId, setBoardId] = useState(() => loadBoardId());
  const [gistId, setGistId] = useState(() => loadGistId());
  const [resultUploadEnabled, setResultUploadEnabled] = useState(() => loadResultUploadEnabled());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gistStatus, setGistStatus] = useState<string | null>(null);
  const [uploadErrorVisible, setUploadErrorVisible] = useState(false);
  const previousPhase = useRef(state.phase);
  const matchFinished = state.phase === "match-finished";

  // Läuft ein Spiel (nicht mehr im Setup), wird jede Änderung sofort
  // gespeichert - so übersteht der Spielstand einen Reload oder das
  // Schließen der App. Landet die Phase wieder bei "setup" (z.B. nach
  // Abbrechen oder Reset), wird der gespeicherte Stand gelöscht.
  useEffect(() => {
    if (state.phase === "setup") {
      clearGameState();
    } else {
      saveGameState(state);
    }
  }, [state]);

  // Nach Spielende kurz das Sieg-Overlay zeigen, dann automatisch zur
  // Statistik-Seite weiterleiten.
  useEffect(() => {
    if (matchFinished) {
      const timer = setTimeout(() => setShowMatchStats(true), MATCH_OVERLAY_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [matchFinished]);

  useEffect(() => {
    const changedToMatchFinished = previousPhase.current !== "match-finished" && matchFinished;
    previousPhase.current = state.phase;

    if (!changedToMatchFinished) return;

    void uploadMatchResult({
      enabled: resultUploadEnabled,
      config: loadGistConfig(gistId),
      boardId,
      state,
    }).then((result) => {
      if (result === "uploaded") setGistStatus("Ergebnis in Gist hochgeladen.");
      if (result === "failed") setUploadErrorVisible(true);
    });
  }, [boardId, gistId, matchFinished, resultUploadEnabled, state]);

  const updateBoardId = (nextBoardId: string) => {
    setBoardId(nextBoardId);
    saveBoardId(nextBoardId);
  };

  const updateGistId = (nextGistId: string) => {
    setGistId(nextGistId);
    saveGistId(nextGistId);
  };

  const updateResultUploadEnabled = (enabled: boolean) => {
    setResultUploadEnabled(enabled);
    saveResultUploadEnabled(enabled);
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
      onBoardIdChange={updateBoardId}
      onGistIdChange={updateGistId}
      onResultUploadEnabledChange={updateResultUploadEnabled}
      onTestConnection={() =>
        testGistConnection(loadGistConfig(gistId)).then((result) =>
          result.ok ? `✓ ${result.message}` : `Verbindung fehlgeschlagen: ${result.message}`
        )
      }
      onClose={() => setSettingsOpen(false)}
    />
  ) : null;

  const uploadErrorPopup = uploadErrorVisible ? (
    <UploadErrorPopup onConfirm={() => setUploadErrorVisible(false)} />
  ) : null;

  if (state.phase === "setup") {
    return (
      <>
        <div className="app__floating-settings">{settingsButton}</div>
        <SetupScreen
          resultUploadEnabled={resultUploadEnabled}
          gistConfig={loadGistConfig(gistId)}
          onStart={(nameA, nameB, legsToWin, startingPlayer) => {
            setShowMatchStats(false);
            setGistStatus(null);
            setUploadErrorVisible(false);
            dispatch({ type: "RESET_MATCH", nameA, nameB, legsToWin });
            if (startingPlayer === 1) dispatch({ type: "SWITCH_STARTING_PLAYER" });
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
          onNewMatch={() => {
            setShowMatchStats(false);
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
        />

        {legWinnerForOverlay && (
          <div className="leg-overlay">
            <div className="leg-overlay__card">
              <h1>{legWinnerForOverlay.name} gewinnt das Leg!</h1>
              <p>
                Legs: {state.players[0].name} {state.players[0].legsWon} : {state.players[1].legsWon}{" "}
                {state.players[1].name}
              </p>
              <button onClick={() => dispatch({ type: "NEXT_LEG" })}>Nächstes Leg</button>
            </div>
          </div>
        )}

        {matchWinnerForOverlay && (
          <div className="leg-overlay">
            <div className="leg-overlay__card">
              <h1>{matchWinnerForOverlay.name} gewinnt das Match!</h1>
              <p>
                {state.players[0].name} {state.players[0].legsWon} : {state.players[1].legsWon}{" "}
                {state.players[1].name}
              </p>
              <p className="leg-overlay__hint">Statistik wird geladen …</p>
              {gistStatus && <p className="gist-status">{gistStatus}</p>}
            </div>
          </div>
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
