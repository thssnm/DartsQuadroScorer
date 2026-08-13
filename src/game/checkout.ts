// Boogey-Zahlen: Reste, die mit 3 Darts NICHT auf ein Double/Bull-Extra
// finishbar sind. Beim Quadro-Board liegt das höchste Finish bei 210
// (Q20 - Q20 - D25 / Bull-Extra), daher liegt der Checkout-Bereich bei
// 2..210 und die klassischen Boogey-Zahlen darunter gelten weiterhin.
export const BOOGEY_NUMBERS = new Set([
  209, 208, 207, 205, 204, 203, 201, 199, 197, 195, 193, 191, 189, 185, 183, 179,
]);

export const MAX_CHECKOUT = 210;

export const isCheckoutRange = (remaining: number): boolean =>
  remaining >= 2 && remaining <= MAX_CHECKOUT && !BOOGEY_NUMBERS.has(remaining);

export const isBoogeyNumber = (remaining: number): boolean => BOOGEY_NUMBERS.has(remaining);
