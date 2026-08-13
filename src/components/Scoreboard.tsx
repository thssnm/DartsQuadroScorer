import type { GameState } from "../game/types";
import { turnTotal } from "../game/types";
import { computePlayerStats } from "../game/stats";
import { isBoogeyNumber, isCheckoutRange } from "../game/checkout";

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
        <ScorePanel score={501} totalScored={501 - p0.remaining} />
        <ScorePanel score={501} totalScored={501 - p1.remaining} />
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

const ScorePanel = ({ score, totalScored }: { score: number; totalScored: number }) => (
  <div className="score-panel">
    <div className="score-panel__header">
      <span>Score</span>
      <span>Punkte</span>
    </div>
    <div className="score-panel__row">
      <strong>{score}</strong>
      <strong>{totalScored}</strong>
    </div>
  </div>
);
