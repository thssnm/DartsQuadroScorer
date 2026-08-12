import { useState } from "react";

interface SetupScreenProps {
  onStart: (nameA: string, nameB: string, legsToWin: number, startingPlayer: 0 | 1) => void;
}

const LEG_OPTIONS = [
  { label: "Best of 1", legsToWin: 1 },
  { label: "Best of 3", legsToWin: 2 },
  { label: "Best of 5", legsToWin: 3 },
  { label: "Best of 7", legsToWin: 4 },
];

export const SetupScreen = ({ onStart }: SetupScreenProps) => {
  const [nameA, setNameA] = useState("Heim");
  const [nameB, setNameB] = useState("Gast");
  const [legsToWin, setLegsToWin] = useState(2);
  const [startingPlayer, setStartingPlayer] = useState<0 | 1>(0);

  return (
    <div className="setup-screen">
      <h1>Neues Spiel — 501 Double Out</h1>

      <div className="setup-row">
        <label>Spieler 1</label>
        <input value={nameA} onChange={(e) => setNameA(e.target.value)} maxLength={16} />
      </div>

      <div className="setup-row">
        <label>Spieler 2</label>
        <input value={nameB} onChange={(e) => setNameB(e.target.value)} maxLength={16} />
      </div>

      <div className="setup-row">
        <label>Legs</label>
        <div className="leg-options">
          {LEG_OPTIONS.map((opt) => (
            <button
              key={opt.legsToWin}
              className={legsToWin === opt.legsToWin ? "active" : ""}
              onClick={() => setLegsToWin(opt.legsToWin)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-row">
        <label>Startspieler</label>
        <button
          className="switch-btn"
          onClick={() => setStartingPlayer((p) => (p === 0 ? 1 : 0))}
        >
          {startingPlayer === 0 ? nameA || "Spieler 1" : nameB || "Spieler 2"} beginnt ⇄
        </button>
      </div>

      <button
        className="start-btn"
        onClick={() => onStart(nameA || "Spieler 1", nameB || "Spieler 2", legsToWin, startingPlayer)}
      >
        Spiel starten
      </button>
    </div>
  );
};
