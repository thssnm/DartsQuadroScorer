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

  return (
    <div className="app">
      <Scoreboard state={state} />
      <DartInput
        dartsThisTurn={state.currentLegDarts}
        onAddDart={(dart) => dispatch({ type: "ADD_DART", dart })}
        onRemoveLast={() => dispatch({ type: "REMOVE_LAST_DART" })}
        onConfirmTurn={() => dispatch({ type: "CONFIRM_TURN" })}
        onBust={() => dispatch({ type: "FORCE_BUST" })}
        disabled={false}
      />
    </div>
  );
}

export default App;
