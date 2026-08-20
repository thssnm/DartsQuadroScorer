import type { GameState } from "../game/types";
import { turnTotal } from "../game/types";
import { computePlayerStats } from "../game/stats";
import { isBoogeyNumber, isCheckoutRange, isWithinCheckoutThreshold } from "../game/checkout";

interface ScoreboardProps {
  state: GameState;
}

const scoreClass = (remaining: number): string => {
  if (isBoogeyNumber(remaining)) return "boogey";
  if (isCheckoutRange(remaining)) return "checkout";
  return "";
};

export const Scoreboard = ({ state }: ScoreboardProps) => {
  const [p0, p1] = state.players;
  const stats0 = computePlayerStats(p0);
  const stats1 = computePlayerStats(p1);

  const lastTurns = (player: typeof p0, count: number) =>
    player.turns.slice(-count).map((t) => (t.bust ? "BUST" : String(turnTotal(t.darts))));

  return (
    <div className="scoreboard">
      <div className="scoreboard__header">
        <div className={`player-name ${state.activePlayer === 0 ? "active" : ""}`}>{p0.name}</div>
        <div className="legs-info">
          {p0.legsWon} Legs {p1.legsWon}
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

      <div className="scoreboard__lastturns">
        <div className="turns-list">
          {lastTurns(p0, 3).map((v, i) => (
            <span key={i}>{v}</span>
          ))}
        </div>
        <div className="turns-list">
          {lastTurns(p1, 3).map((v, i) => (
            <span key={i}>{v}</span>
          ))}
        </div>
      </div>

      <div className="scoreboard__stats">
        <StatsPanel stats={stats0} />
        <ScorePanel player={p0} />
        <ScorePanel player={p1} />
        <StatsPanel stats={stats1} />
      </div>
    </div>
  );
};

const StatsPanel = ({ stats }: { stats: ReturnType<typeof computePlayerStats> }) => (
  <div className="stats-panel">
    <h3>Statistiken</h3>
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
        <strong>{stats.bestLeg ? `${stats.bestLeg.darts}D` : "-"}</strong>
      </div>
    </div>
  </div>
);

const ScorePanel = ({ player }: { player: GameState["players"][number] }) => {
  // Rest-Score nach jeder Aufnahme berechnen, um die Zeilen aufzubauen.
  // Bei Bust bleibt der Rest unverändert (turn.scoreAfter trägt das bereits korrekt).
  const rows = player.turns.map((t) => ({
    points: t.bust ? 0 : turnTotal(t.darts),
    remainingAfter: t.scoreAfter,
    bust: t.bust,
  }));

  return (
    <div className="score-panel">
      <div className="score-panel__header">
        <span>Punkte</span>
        <span>Score</span>
      </div>
      <div className="score-panel__list">
        <div className="score-panel__row">
          <strong></strong>
          <strong>501</strong>
        </div>
        {rows.map((row, i) => (
          <div
            key={i}
            className={`score-panel__row ${isWithinCheckoutThreshold(row.remainingAfter) ? "near-checkout" : ""}`}
          >
            <strong>{row.bust ? "BUST" : row.points}</strong>
            <strong>{row.remainingAfter}</strong>
            {isWithinCheckoutThreshold(row.remainingAfter) && (
              <svg className="checkout-line" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="6" y1="65" x2="94" y2="35" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
