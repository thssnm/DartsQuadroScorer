import { useEffect, useState } from "react";
import loveForDartsLogo from "../assets/Love-for-Darts-Logo.svg";
import { loadSetupPlayerNames } from "../api/playerNames";
import { loadLastBestOf, loadLastInputMode } from "../game/persistence";
import type { InputMode } from "../game/types";
import { DEFAULT_BEST_OF, bestOfFromInput } from "./setupLegs";

interface SetupScreenProps {
  onStart: (nameA: string, nameB: string, bestOf: number, inputMode: InputMode) => void;
}


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
      <input value={value} onChange={(e) => onChange(e.target.value)} />
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

export const SetupScreen = ({ onStart }: SetupScreenProps) => {
  const [nameA, setNameA] = useState("Heim");
  const [nameB, setNameB] = useState("Gast");
  // Vorbelegt mit dem zuletzt gestarteten Match, beim ersten Mal 3.
  const [bestOf, setBestOf] = useState(() => String(loadLastBestOf(DEFAULT_BEST_OF)));
  // Vorbelegt mit der letzten Wahl, beim ersten Mal Einzeldarteingabe.
  const [singleDarts, setSingleDarts] = useState(() => loadLastInputMode() === "darts");
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  useEffect(() => {
    let ignore = false;
    void loadSetupPlayerNames().then((players) => {
      if (!ignore) setPlayerNames(players);
    });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="setup-screen">
      <a
        className="setup-sponsor"
        href="https://lovefordarts.de"
        target="_blank"
        rel="noreferrer"
        aria-label="Love for Darts Website öffnen"
      >
        <span>Partner</span>
        <img src={loveForDartsLogo} alt="Love for Darts" />
      </a>

      <h1>Neues Spiel — 501 Double Out</h1>

      <PlayerNameField label="Spieler 1" value={nameA} playerNames={playerNames} onChange={setNameA} />
      <PlayerNameField label="Spieler 2" value={nameB} playerNames={playerNames} onChange={setNameB} />

      <div className="setup-row">
        <label htmlFor="setup-best-of">Best of (Legs)</label>
        <input
          id="setup-best-of"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={bestOf}
          onChange={(e) => setBestOf(e.target.value)}
        />
      </div>

      <div className="setup-row">
        <label className="setup-checkbox">
          <input type="checkbox" checked={singleDarts} onChange={(e) => setSingleDarts(e.target.checked)} />
          <span>Einzeldarteingabe</span>
        </label>
        <p className="setup-hint">
          {singleDarts
            ? "Jeder Dart wird einzeln eingegeben, die App prüft das Double."
            : "Nur die Summe der Aufnahme wird eingegeben, gerechnet wird selbst."}
        </p>
      </div>

      <button
        className="start-btn"
        onClick={() =>
          onStart(nameA || "Spieler 1", nameB || "Spieler 2", bestOfFromInput(bestOf), singleDarts ? "darts" : "score")
        }
      >
        Spiel starten
      </button>
    </div>
  );
};
