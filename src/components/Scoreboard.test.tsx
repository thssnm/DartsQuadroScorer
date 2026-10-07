import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Scoreboard } from "./Scoreboard";
import { createInitialState } from "../game/gameReducer";
import type { GameState, PlayerState, Turn } from "../game/types";

const turn = (points: number, scoreBefore: number): Turn => ({
  darts: [{ segment: points, multiplier: 1 }],
  scoreBefore,
  scoreAfter: scoreBefore - points,
  bust: false,
});

const withTurns = (player: PlayerState, turns: Turn[]): PlayerState => ({
  ...player,
  turns,
  remaining: turns.length > 0 ? turns[turns.length - 1].scoreAfter : player.remaining,
});

const stateWithTurns = (turns0: Turn[], turns1: Turn[]): GameState => {
  const initial = createInitialState("A", "B", 1);
  return {
    ...initial,
    phase: "playing",
    players: [withTurns(initial.players[0], turns0), withTurns(initial.players[1], turns1)],
  };
};

// Die Startzeile trägt ein geschütztes Leerzeichen, damit sie dieselbe Höhe
// hat wie die "501"-Zeile der Score-Tabellen.
const BLANK_ROW = "\u00a0";

const dartsColumn = (markup: string): string[] => {
  const afterDarts = markup.split('class="score-panel darts-panel"')[1] ?? "";
  const panel = afterDarts.split('class="score-panel"')[0];
  return [...panel.matchAll(/<strong>(.*?)<\/strong>/g)].map((m) => m[1]);
};

describe("Scoreboard", () => {
  it("renders the darts column between both score tables", () => {
    const state = stateWithTurns([turn(60, 501)], []);
    const markup = renderToStaticMarkup(<Scoreboard state={state} onEditTurn={vi.fn()} />);

    const scorePanels = [...markup.matchAll(/class="score-panel(?: darts-panel)?"/g)];
    expect(scorePanels).toHaveLength(3);
    expect(scorePanels[1][0]).toContain("darts-panel");
  });

  it("counts three darts per row regardless of the finish dart rule", () => {
    const state = stateWithTurns(
      [turn(60, 501), turn(60, 441), turn(60, 381)],
      [turn(60, 501), turn(60, 441)]
    );
    const markup = renderToStaticMarkup(<Scoreboard state={state} onEditTurn={vi.fn()} />);

    // Startzeile ohne Zahl (analog zur "501"-Zeile), danach 3er-Schritte.
    expect(dartsColumn(markup)).toEqual([BLANK_ROW, "3", "6", "9"]);
  });

  it("uses the longer of both players' turn lists for the row count", () => {
    const state = stateWithTurns([turn(60, 501)], [turn(60, 501), turn(60, 441)]);
    const markup = renderToStaticMarkup(<Scoreboard state={state} onEditTurn={vi.fn()} />);

    expect(dartsColumn(markup)).toEqual([BLANK_ROW, "3", "6"]);
  });
});
