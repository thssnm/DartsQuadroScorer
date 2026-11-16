export const DEFAULT_BEST_OF = 3;

// "Best of N" → nötige Legs zum Sieg. Eine gerade oder ungültige Eingabe
// wird auf das nächste sinnvolle Match abgebildet: Best of 4 heißt wie
// Best of 3 "wer zuerst 2 Legs hat", leer oder 0 fällt auf den Default.
export const legsToWinFromBestOf = (bestOf: string): number => {
  const parsed = Number.parseInt(bestOf, 10);
  const legs = Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_BEST_OF;
  return Math.ceil(legs / 2);
};
