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

const render = (turns0: Turn[], turns1: Turn[]): string =>
  renderToStaticMarkup(<Scoreboard state={stateWithTurns(turns0, turns1)} onEditTurn={vi.fn()} />);

// Der Tabellenkörper ist das Grid mit allen Zellen - der einzige Scroll-Container.
const bodyCells = (markup: string): string[] => {
  const body = markup.split('class="score-table__body"')[1] ?? "";
  return [...body.matchAll(/<(?:div|button) class="score-table__row[^"]*"[^>]*>(.*?)<\/(?:div|button)>/g)].map(
    (m) => m[1].replace(/<[^>]+>/g, "|")
  );
};

// Die Darts-Spalte ist jede dritte Zelle (p0 | Darts | p1).
const dartsColumn = (markup: string): string[] =>
  bodyCells(markup).filter((_, i) => i % 3 === 1);

describe("Scoreboard", () => {
  it("renders both players and the darts column in a single scroll container", () => {
    const markup = render([turn(60, 501)], []);

    expect([...markup.matchAll(/class="score-table__body"/g)]).toHaveLength(1);
    expect(markup).not.toContain("score-panel__list");
  });

  it("counts three darts per row regardless of the finish dart rule", () => {
    const markup = render(
      [turn(60, 501), turn(60, 441), turn(60, 381)],
      [turn(60, 501), turn(60, 441)]
    );

    // Startzeile ohne Zahl (analog zur "501"-Zeile), danach 3er-Schritte.
    expect(dartsColumn(markup)).toEqual(["| |", "|3|", "|6|", "|9|"]);
  });

  it("keeps an empty cell for the player who has not thrown in that round", () => {
    const cells = bodyCells(render([turn(60, 501), turn(60, 441)], [turn(60, 501)]));

    // Zeile 2 (Index 6..8): Aufnahme von A, Darts, leere Zelle für B.
    expect(cells.slice(6, 9)).toEqual(["|60||381|", "|6|", ""]);
  });
});
