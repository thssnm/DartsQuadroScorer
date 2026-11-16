export const DEFAULT_BEST_OF = 3;

// "Best of N": Gesamtzahl der Legs, gerade Werte erlaubt (dann ist ein
// Unentschieden möglich). Leer, 0 oder Unsinn fällt auf den Default.
export const bestOfFromInput = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_BEST_OF;
};
