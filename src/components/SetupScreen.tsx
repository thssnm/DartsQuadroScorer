import { useEffect, useRef, useState } from "react";
import type { GistConfig } from "../gist/config";
import { loadSetupPlayerNames } from "../gist/playerNames";

interface SetupScreenProps {
  onStart: (nameA: string, nameB: string, legsToWin: number, startingPlayer: 0 | 1) => void;
  resultUploadEnabled: boolean;
  gistConfig: GistConfig;
}

const LEG_OPTIONS = [
  { label: "Best of 1", legsToWin: 1 },
  { label: "Best of 3", legsToWin: 2 },
  { label: "Best of 5", legsToWin: 3 },
  { label: "Best of 7", legsToWin: 4 },
];

interface PlayerNameFieldProps {
  label: string;
  value: string;
  playerNames: string[];
  onChange: (value: string) => void;
}

export const PlayerNameField = ({ label, value, playerNames, onChange }: PlayerNameFieldProps) => (
  <div className="setup-row">
    <label>{label}</label>
    <div className="setup-player-field">
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={16} />
      {playerNames.length > 0 && (
        <select value="" onChange={(e) => onChange(e.target.value)} aria-label={`${label} auswählen`}>
          <option value="" disabled>
            Spieler wählen
          </option>
          {playerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}
    </div>
  </div>
);

export const SetupScreen = ({ onStart, resultUploadEnabled, gistConfig }: SetupScreenProps) => {
  const [nameA, setNameA] = useState("Heim");
  const [nameB, setNameB] = useState("Gast");
  const [legsToWin, setLegsToWin] = useState(2);
  const [startingPlayer, setStartingPlayer] = useState<0 | 1>(0);
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const initialPlayerLookup = useRef({ resultUploadEnabled, gistConfig });

  useEffect(() => {
    let ignore = false;
    const lookup = initialPlayerLookup.current;
    void loadSetupPlayerNames(lookup.resultUploadEnabled, lookup.gistConfig).then((players) => {
      if (!ignore) setPlayerNames(players);
    });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="setup-screen">
      <h1>Neues Spiel — 501 Double Out</h1>

      <PlayerNameField label="Spieler 1" value={nameA} playerNames={playerNames} onChange={setNameA} />
      <PlayerNameField label="Spieler 2" value={nameB} playerNames={playerNames} onChange={setNameB} />

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
