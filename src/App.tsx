import { useEffect, useReducer, useState } from "react";
import { createInitialState, gameReducer } from "./game/gameReducer";
import { SetupScreen } from "./components/SetupScreen";
import { Scoreboard } from "./components/Scoreboard";
import { DartInput } from "./components/DartInput";
import { MatchStats } from "./components/MatchStats";
import "./App.css";

const MATCH_OVERLAY_DURATION_MS = 2500;

function App() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState("Heim", "Gast", 2));
  const [showMatchStats, setShowMatchStats] = useState(false);

  // Nach Spielende kurz das Sieg-Overlay zeigen, dann automatisch zur
  // Statistik-Seite weiterleiten.
  useEffect(() => {
    if (state.phase === "match-finished") {
      setShowMatchStats(false);
      const timer = setTimeout(() => setShowMatchStats(true), MATCH_OVERLAY_DURATION_MS);
      return () => clearTimeout(timer);
    }
    setShowMatchStats(false);
  }, [state.phase]);

  if (state.phase === "setup") {
    return (
      <SetupScreen
        onStart={(nameA, nameB, legsToWin, startingPlayer) => {
          dispatch({ type: "RESET_MATCH", nameA, nameB, legsToWin });
          if (startingPlayer === 1) dispatch({ type: "SWITCH_STARTING_PLAYER" });
          dispatch({ type: "START_MATCH" });
        }}
      />
    );
  }

  if (state.phase === "match-finished" && showMatchStats) {
    return (
      <MatchStats
        state={state}
        onNewMatch={() =>
          dispatch({
            type: "RESET_MATCH",
            nameA: state.players[0].name,
            nameB: state.players[1].name,
            legsToWin: state.legsToWin,
          })
        }
      />
    );
  }

  const lastThrowerIdx: 0 | 1 = state.activePlayer === 0 ? 1 : 0;
  const canUndo = state.players[lastThrowerIdx].turns.length > 0;

  const legWinnerForOverlay =
    state.phase === "leg-finished"
      ? state.players[0].remaining === 0
        ? state.players[0]
        : state.players[1]
      : null;

  const matchWinnerForOverlay =
    state.phase === "match-finished"
      ? state.players[0].legsWon > state.players[1].legsWon
        ? state.players[0]
        : state.players[1]
      : null;

  return (
    <div className="app">
      <div className="app__topbar">
        <button
          className="abort-btn"
          onClick={() => {
            if (window.confirm("Spiel wirklich abbrechen und neu starten?")) {
              dispatch({ type: "ABORT_MATCH" });
            }
          }}
        >
          Spiel abbrechen
        </button>
      </div>
      <Scoreboard
        state={state}
        onEditTurn={(playerIndex, turnIndex) => dispatch({ type: "EDIT_TURN", playerIndex, turnIndex })}
      />
      <DartInput
        slots={state.currentSlots}
        onSetSegment={(index, segment) => dispatch({ type: "SET_SLOT_SEGMENT", index, segment })}
        onSetMultiplier={(index, multiplier) =>
          dispatch({ type: "SET_SLOT_MULTIPLIER", index, multiplier })
        }
        onClearSlot={(index) => dispatch({ type: "CLEAR_SLOT", index })}
        onConfirmTurn={() => dispatch({ type: "CONFIRM_TURN" })}
        onUndo={() => dispatch({ type: "UNDO_LAST_TURN" })}
        canUndo={canUndo}
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
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
