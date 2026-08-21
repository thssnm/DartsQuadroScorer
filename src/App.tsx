import { useReducer } from "react";
import { createInitialState, gameReducer } from "./game/gameReducer";
import { SetupScreen } from "./components/SetupScreen";
import { Scoreboard } from "./components/Scoreboard";
import { DartInput } from "./components/DartInput";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState("Heim", "Gast", 2));

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

  if (state.phase === "match-finished") {
    const winner =
      state.players[0].legsWon > state.players[1].legsWon ? state.players[0] : state.players[1];
    return (
      <div className="match-finished">
        <h1>{winner.name} gewinnt das Match!</h1>
        <p>
          {state.players[0].name} {state.players[0].legsWon} : {state.players[1].legsWon}{" "}
          {state.players[1].name}
        </p>
        <button
          onClick={() =>
            dispatch({
              type: "RESET_MATCH",
              nameA: state.players[0].name,
              nameB: state.players[1].name,
              legsToWin: state.legsToWin,
            })
          }
        >
          Neues Match
        </button>
      </div>
    );
  }

  if (state.phase === "leg-finished") {
    const legWinner = state.players[0].remaining === 0 ? state.players[0] : state.players[1];
    return (
      <div className="leg-finished">
        <h1>{legWinner.name} gewinnt das Leg!</h1>
        <p>
          Legs: {state.players[0].name} {state.players[0].legsWon} : {state.players[1].legsWon}{" "}
          {state.players[1].name}
        </p>
        <button onClick={() => dispatch({ type: "NEXT_LEG" })}>Nächstes Leg</button>
      </div>
    );
  }

  // Der Spieler, der zuletzt geworfen hat, ist NICHT state.activePlayer
  // (activePlayer wurde nach CONFIRM_TURN bereits gewechselt).
  const lastThrowerIdx: 0 | 1 = state.activePlayer === 0 ? 1 : 0;
  const canUndo = state.players[lastThrowerIdx].turns.length > 0;

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
      <Scoreboard state={state} />
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
    </div>
  );
}

export default App;
