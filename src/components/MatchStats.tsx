import type { GameState, PlayerState } from "../game/types";
import { turnTotal } from "../game/types";
import { computePlayerStats } from "../game/stats";
import { dartsInTurns } from "../game/dartCount";

interface MatchStatsProps {
  state: GameState;
  onNewMatch: () => void;
  gistStatus?: string | null;
  // Gesperrt, solange der Upload läuft oder sein Fehler noch nicht
  // quittiert wurde.
  newMatchDisabled?: boolean;
}

const scoreInTurns = (turns: PlayerState["turns"]) =>
  turns.reduce((sum, t) => sum + (t.bust ? 0 : turnTotal(t.darts)), 0);
const legAverage = (turns: PlayerState["turns"]): number => {
  const darts = dartsInTurns(turns);
  return darts > 0 ? (scoreInTurns(turns) / darts) * 3 : 0;
};

export const MatchStats = ({
  state,
  onNewMatch,
  gistStatus,
  newMatchDisabled = false,
}: MatchStatsProps) => {
  const [p0, p1] = state.players;
  const winner = p0.legsWon > p1.legsWon ? p0 : p1;
  const stats0 = computePlayerStats(p0);
  const stats1 = computePlayerStats(p1);

  const legCount = Math.max(p0.legHistory.length, p1.legHistory.length);

  // Zweite Absicherung neben dem disabled-Attribut: solange der Upload nicht
  // aufgelöst ist, darf auch ein durchkommender Klick nichts auslösen.
  const handleNewMatch = () => {
    if (newMatchDisabled) return;
    onNewMatch();
  };

  return (
    <div className="match-stats">
      <h1>{winner.name} gewinnt das Match!</h1>
      <p className="match-stats__score">
        {p0.name} {p0.legsWon} : {p1.legsWon} {p1.name}
      </p>
      {gistStatus && <p className="match-stats__gist-status">{gistStatus}</p>}

      <div className="match-stats__summary">
        <PlayerSummary name={p0.name} stats={stats0} />
        <PlayerSummary name={p1.name} stats={stats1} />
      </div>

      <h2>Legs im Detail</h2>
      <div className="match-stats__legs">
        <div className="match-stats__legs-header">
          <span>Leg</span>
          <span>{p0.name}</span>
          <span>{p1.name}</span>
        </div>
        {Array.from({ length: legCount }).map((_, i) => {
          const leg0 = p0.legHistory[i];
          const leg1 = p1.legHistory[i];
          return (
            <div key={i} className="match-stats__legs-row">
              <span>Leg {i + 1}</span>
              <LegCell leg={leg0} />
              <LegCell leg={leg1} />
            </div>
          );
        })}
      </div>

      <button onClick={handleNewMatch} disabled={newMatchDisabled}>
        Neues Match
      </button>
    </div>
  );
};

const PlayerSummary = ({ name, stats }: { name: string; stats: ReturnType<typeof computePlayerStats> }) => (
  <div className="match-stats__player">
    <h3>{name}</h3>
    <div className="match-stats__player-grid">
      <div>
        <span>Spiel Ø</span>
        <strong>{stats.matchAverage.toFixed(1)}</strong>
      </div>
      <div>
        <span>Best Leg</span>
        <strong>{stats.bestLeg ? `${stats.bestLeg.darts} Darts` : "-"}</strong>
      </div>
      <div>
        <span>140+</span>
        <strong>{stats.count140Plus}</strong>
      </div>
      <div>
        <span>180+</span>
        <strong>{stats.count180Plus}</strong>
      </div>
      <div>
        <span>240</span>
        <strong>{stats.count240}</strong>
      </div>
    </div>
  </div>
);

const LegCell = ({ leg }: { leg: PlayerState["legHistory"][number] | undefined }) => {
  if (!leg) return <span className="leg-cell leg-cell--empty">-</span>;
  const darts = dartsInTurns(leg.turns);
  const avg = legAverage(leg.turns);
  return (
    <span className={`leg-cell ${leg.won ? "leg-cell--won" : ""}`}>
      {leg.won ? darts : "-"} <small>Ø{avg.toFixed(1)}</small>
    </span>
  );
};
