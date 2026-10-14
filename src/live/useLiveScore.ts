import { useEffect, useState, useSyncExternalStore } from "react";
import { LiveScoreSender, type LiveObservation, type LiveSendStatus } from "./sender";

// Einziger React-Teil des Livescore-Senders: reicht jeden Render an den
// Sender weiter und liefert dessen Status für die Zeile im Settings-Modal.
export const useLiveScore = ({ state, matchConfirmed, boardId, enabled, token }: LiveObservation): LiveSendStatus => {
  const [sender] = useState(() => new LiveScoreSender());

  useEffect(() => {
    try {
      sender.observe({ state, matchConfirmed, boardId, enabled, token });
    } catch {
      // observe fängt selbst ab - doppelt hält besser, das Spiel geht vor.
    }
  }, [sender, state, matchConfirmed, boardId, enabled, token]);

  return useSyncExternalStore(sender.subscribe, sender.getStatus, sender.getStatus);
};
