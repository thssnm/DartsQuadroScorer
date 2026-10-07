import { Fragment, useEffect, useRef } from "react";
import type { GameState, PlayerState } from "../game/types";
import { turnTotal } from "../game/types";
import { computePlayerStats } from "../game/stats";
import { isBoogeyNumber, isCheckoutRange, isWithinCheckoutThreshold } from "../game/checkout";

interface ScoreboardProps {
  state: GameState;
  onEditTurn: (playerIndex: 0 | 1, turnIndex: number) => void;
}

const scoreClass = (remaining: number): string => {
  if (isBoogeyNumber(remaining)) return "boogey";
  if (isCheckoutRange(remaining)) return "checkout";
  return "";
};

export const Scoreboard = ({ state, onEditTurn }: ScoreboardProps) => {
  const [p0, p1] = state.players;
  const stats0 = computePlayerStats(p0);
  const stats1 = computePlayerStats(p1);

  return (
    <div className="scoreboard">
      <div className="scoreboard__header">
        <div className={`player-name ${state.activePlayer === 0 ? "active" : ""}`}>{p0.name}</div>
        <div className="legs-info">
          {p0.legsWon} : {p1.legsWon}
          <span className="legs-format">(Best of {state.legsToWin * 2 - 1} Legs)</span>
        </div>
        <div className={`player-name ${state.activePlayer === 1 ? "active" : ""}`}>{p1.name}</div>
      </div>

      <div className="scoreboard__scores">
        <div className={`score-box ${state.activePlayer === 0 ? "active" : ""} ${scoreClass(p0.remaining)}`}>
          {p0.remaining}
        </div>
        <div className={`score-box ${state.activePlayer === 1 ? "active" : ""} ${scoreClass(p1.remaining)}`}>
          {p1.remaining}
        </div>
      </div>

      <div className="scoreboard__stats">
        <StatsPanel stats={stats0} />
        <ScoreTable players={state.players} onEditTurn={onEditTurn} />
        <StatsPanel stats={stats1} />
      </div>
    </div>
  );
};

const StatsPanel = ({ stats }: { stats: ReturnType<typeof computePlayerStats> }) => (
  <div className="stats-panel">
    <div className="stats-grid">
      <div className="stat-box">
        <span>140+</span>
        <strong>{stats.count140Plus}</strong>
      </div>
      <div className="stat-box">
        <span>180+</span>
        <strong>{stats.count180Plus}</strong>
      </div>
      <div className="stat-box">
        <span>240</span>
        <strong>{stats.count240}</strong>
      </div>
      <div className="stat-box">
        <span>Spiel Ø</span>
        <strong>{stats.matchAverage.toFixed(1)}</strong>
      </div>
      <div className="stat-box">
        <span>Leg Ø</span>
        <strong>{stats.legAverage.toFixed(1)}</strong>
      </div>
      <div className="stat-box">
        <span>Best</span>
        <strong>{stats.bestLeg ? stats.bestLeg.darts : "-"}</strong>
      </div>
    </div>
  </div>
);

// Beide Punkte/Score-Spalten und die Darts-Spalte liegen in EINEM Grid und
// damit in einem einzigen Scroll-Container. Getrennte Listen pro Spieler
// ließen sich einzeln scrollen - die Zeilen beider Seiten standen dann nicht
// mehr auf einer Höhe.
const ScoreTable = ({
  players,
  onEditTurn,
}: {
  players: GameState["players"];
  onEditTurn: (playerIndex: 0 | 1, turnIndex: number) => void;
}) => {
  const [p0, p1] = players;
  const rowCount = Math.max(p0.turns.length, p1.turns.length);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Hält die Tabelle am unteren Ende, damit die zuletzt bestätigte Aufnahme
  // sichtbar bleibt.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, [rowCount]);

  return (
    <div className="score-table">
      <div className="score-table__header">
        <div className="score-table__head-cell">
          <span>Punkte</span>
          <span>Score</span>
        </div>
        <div className="score-table__head-cell score-table__head-cell--darts">
          <span>Darts</span>
        </div>
        <div className="score-table__head-cell">
          <span>Punkte</span>
          <span>Score</span>
        </div>
      </div>

      <div className="score-table__body" ref={bodyRef}>
        <StartRowCell />
        {/* Startzeile der Darts-Spalte bleibt leer, das geschützte Leerzeichen
            hält sie auf voller Zeilenhöhe. */}
        <div className="score-table__row score-table__row--darts">
          <strong>&nbsp;</strong>
        </div>
        <StartRowCell />

        {Array.from({ length: rowCount }, (_, i) => (
          <Fragment key={i}>
            <TurnCell player={p0} playerIndex={0} turnIndex={i} onEditTurn={onEditTurn} />
            {/* Bewusst schlicht drei Darts pro Aufnahme - die differenzierte
                Finish-Dart-Zählregel gilt nur für Statistik und Highlights. */}
            <div className="score-table__row score-table__row--darts">
              <strong>{(i + 1) * 3}</strong>
            </div>
            <TurnCell player={p1} playerIndex={1} turnIndex={i} onEditTurn={onEditTurn} />
          </Fragment>
        ))}
      </div>
    </div>
  );
};

const StartRowCell = () => (
  <div className="score-table__row">
    <strong></strong>
    <strong>501</strong>
  </div>
);

const TurnCell = ({
  player,
  playerIndex,
  turnIndex,
  onEditTurn,
}: {
  player: PlayerState;
  playerIndex: 0 | 1;
  turnIndex: number;
  onEditTurn: (playerIndex: 0 | 1, turnIndex: number) => void;
}) => {
  const turn = player.turns[turnIndex];
  // Der Spieler, der in dieser Runde noch nicht geworfen hat, bekommt eine
  // leere Zelle - die Zeile muss trotzdem stehen, damit die Gegenseite und
  // die Darts-Spalte auf ihrer Höhe bleiben.
  if (!turn) return <div className="score-table__row" />;

  // Bei Bust bleibt der Rest unverändert (turn.scoreAfter trägt das bereits korrekt).
  const nearCheckout = isWithinCheckoutThreshold(turn.scoreAfter);

  return (
    <button
      className={`score-table__row score-table__row--editable ${nearCheckout ? "near-checkout" : ""}`}
      onClick={() => onEditTurn(playerIndex, turnIndex)}
    >
      <strong>{turn.bust ? "BUST" : turnTotal(turn.darts)}</strong>
      <strong>{turn.scoreAfter}</strong>
      {nearCheckout && (
        <svg className="checkout-line" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="6" y1="65" x2="94" y2="35" />
        </svg>
      )}
    </button>
  );
};
