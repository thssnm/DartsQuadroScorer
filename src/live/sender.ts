import { ApiHttpError, isDuplicateMatchError } from "../api/client";
import {
  loadApiAuth,
  loadLiveScoreSession,
  saveApiAuth,
  saveLiveScoreSession,
} from "../game/persistence";
import type { GameState } from "../game/types";
import { createMatchFileId, defaultBoardName } from "../gist/api";
import { createLiveRecord, findLiveRecordId, refreshLiveToken, updateLiveRecord } from "./client";
import { buildLiveSnapshot, sameSnapshot, type LiveSnapshot } from "./snapshot";

// Was der Sender pro Render vom Spiel sieht. Er liest nur - Aktionen löst er
// nie aus, und kein Fehler verlässt diese Klasse.
export interface LiveObservation {
  state: GameState;
  // "Weiter zur Statistik" geklickt (match-confirmed).
  matchConfirmed: boolean;
  boardId: string;
  enabled: boolean;
  // Token aus dem App-Zustand; null = nicht angemeldet.
  token: string | null;
}

export type LiveSendStatus =
  | { kind: "idle" }
  | { kind: "sent"; at: Date }
  | { kind: "error"; message: string }
  | { kind: "auth-expired" };

const pad = (value: number): string => String(value).padStart(2, "0");

export const describeLiveSendStatus = (status: LiveSendStatus): string | null => {
  switch (status.kind) {
    case "sent":
      return `Zuletzt gesendet: ${pad(status.at.getHours())}:${pad(status.at.getMinutes())}:${pad(status.at.getSeconds())}`;
    case "error":
      return `Fehler: ${status.message}`;
    case "auth-expired":
      return "Anmeldung abgelaufen";
    default:
      return null;
  }
};

const isAuthError = (error: unknown): boolean =>
  error instanceof ApiHttpError && (error.status === 401 || error.status === 403);

const describeError = (error: unknown): string => {
  if (error instanceof ApiHttpError) return `API-Fehler (${error.status}): ${error.message}`;
  if (error instanceof Error && error.name === "AbortError") return "Zeitüberschreitung";
  if (error instanceof TypeError) return "keine Verbindung zur API";
  return error instanceof Error ? error.message : String(error);
};

interface Job {
  snapshot: LiveSnapshot;
  // Letzter Snapshot des Matches: danach verfällt die Session.
  closeAfter: boolean;
}

export class LiveScoreSender {
  private lastSubmitted: LiveSnapshot | null = null;
  private lastToken: string | null | undefined = undefined;
  private wasActive = false;
  private resend = false;
  private paused = false;
  // Höchstens ein offener Request. Pro matchId wartet nur der neueste
  // Snapshot (latest wins); ein Abschluss-Snapshot des alten Matches wird
  // vom ersten Snapshot eines neuen Matches nicht verdrängt.
  private readonly pending = new Map<string, Job>();
  private draining: Promise<void> | null = null;
  private status: LiveSendStatus = { kind: "idle" };
  private readonly listeners = new Set<() => void>();
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  getStatus = (): LiveSendStatus => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // Für Tests: wartet, bis kein Request mehr offen ist.
  idle = async (): Promise<void> => {
    while (this.draining) await this.draining;
  };

  observe(observation: LiveObservation): void {
    try {
      this.observeUnsafe(observation);
    } catch (error) {
      this.setStatus({ kind: "error", message: describeError(error) });
    }
  }

  private observeUnsafe({ state, matchConfirmed, boardId, enabled, token }: LiveObservation): void {
    if (token !== this.lastToken) {
      // Neues Token (Login, Refresh im App-Zustand): eine Pause wegen
      // abgelaufener Anmeldung endet, der aktuelle Stand geht erneut raus.
      if (token && this.lastToken !== undefined) {
        this.paused = false;
        this.resend = true;
        if (this.status.kind === "auth-expired") this.setStatus({ kind: "idle" });
      }
      this.lastToken = token;
    }

    const active = enabled && token !== null && !this.paused;
    if (!active) {
      // Abgeschaltet oder abgemeldet: nichts mehr senden. Das Veralten des
      // Eintrags regelt der Ticker über "updated".
      this.pending.clear();
      if (this.wasActive) this.resend = true;
      this.wasActive = false;
      if (state.phase === "setup") {
        this.lastSubmitted = null;
        saveLiveScoreSession(null);
      }
      return;
    }
    this.wasActive = true;

    if (state.phase === "setup") {
      this.observeSetup();
      return;
    }

    const finished = matchConfirmed && state.phase === "match-finished";
    let session = loadLiveScoreSession();
    if (!session) {
      // Ein bereits abgeschlossenes Match bekommt keine neue liveMatchId.
      if (finished) return;
      session = { matchId: createMatchFileId() };
      saveLiveScoreSession(session);
    }

    const snapshot = buildLiveSnapshot(state, defaultBoardName(boardId), session.matchId, matchConfirmed);
    if (!this.resend && sameSnapshot(snapshot, this.lastSubmitted)) return;
    this.resend = false;
    this.lastSubmitted = snapshot;
    this.submit({ snapshot, closeAfter: snapshot.status === "finished" });
  }

  // Phase "setup": entweder Abbruch eines laufenden Matches (letzter
  // Snapshot war "live") oder Start/Reload ohne Match.
  private observeSetup(): void {
    const last = this.lastSubmitted;
    if (last?.status === "live" && loadLiveScoreSession()?.matchId === last.matchId) {
      // "Spiel abbrechen": der Eintrag verschwindet aus dem Ticker.
      this.lastSubmitted = { ...last, status: "finished" };
      this.submit({ snapshot: this.lastSubmitted, closeAfter: true });
      return;
    }
    // Ein Abschluss-Snapshot ist schon unterwegs oder erledigt.
    if (last?.status === "finished") return;
    this.lastSubmitted = null;
    saveLiveScoreSession(null);
  }

  private submit(job: Job): void {
    this.pending.set(job.snapshot.matchId, job);
    if (!this.draining) {
      this.draining = this.drain().finally(() => {
        this.draining = null;
      });
    }
  }

  private async drain(): Promise<void> {
    for (;;) {
      if (this.paused) this.pending.clear();
      const next = this.pending.entries().next();
      if (next.done) return;
      const [key, job] = next.value;
      this.pending.delete(key);
      await this.send(job);
    }
  }

  private async send(job: Job): Promise<void> {
    try {
      const auth = loadApiAuth();
      if (!auth) return;
      try {
        await this.deliver(auth.token, job.snapshot);
      } catch (error) {
        if (!isAuthError(error)) throw error;
        await this.refreshAndRetry(auth, job.snapshot);
      }
      this.setStatus({ kind: "sent", at: this.now() });
    } catch (error) {
      if (this.paused) this.setStatus({ kind: "auth-expired" });
      else this.setStatus({ kind: "error", message: describeError(error) });
    } finally {
      if (job.closeAfter) this.closeSession(job.snapshot.matchId);
    }
  }

  // Genau ein Refresh und ein Wiederholversuch. Lehnt die API auch das ab,
  // pausiert der Sender bis zum nächsten Login oder App-Start.
  private async refreshAndRetry(auth: { token: string; email: string }, snapshot: LiveSnapshot): Promise<void> {
    let refreshed: { token: string; email?: string };
    try {
      refreshed = await refreshLiveToken(auth.token);
    } catch (error) {
      // Abgelehnter Refresh pausiert, ein Netzwerkfehler dabei nicht.
      if (error instanceof ApiHttpError) this.paused = true;
      throw error;
    }
    // Zwischenzeitlich abgemeldet? Dann kein Token zurückschreiben.
    if (loadApiAuth()?.token === auth.token) {
      saveApiAuth({ token: refreshed.token, email: refreshed.email ?? auth.email });
    }
    try {
      await this.deliver(refreshed.token, snapshot);
    } catch (error) {
      if (isAuthError(error)) this.paused = true;
      throw error;
    }
  }

  private async deliver(token: string, snapshot: LiveSnapshot): Promise<void> {
    const session = loadLiveScoreSession();
    const knownId = session?.matchId === snapshot.matchId ? session.recordId : undefined;
    if (knownId) {
      await updateLiveRecord(token, knownId, snapshot);
      return;
    }
    try {
      this.rememberRecordId(snapshot.matchId, await createLiveRecord(token, snapshot));
    } catch (error) {
      // Datensatz existiert schon (Reload ohne gespeicherte id): suchen und
      // weiter per PATCH.
      if (!isDuplicateMatchError(error)) throw error;
      const id = await findLiveRecordId(token, snapshot.matchId);
      if (!id) throw error;
      this.rememberRecordId(snapshot.matchId, id);
      await updateLiveRecord(token, id, snapshot);
    }
  }

  // Nur zur eigenen matchId speichern - eine inzwischen gelöschte oder neue
  // Session bleibt unangetastet.
  private rememberRecordId(matchId: string, recordId: string): void {
    if (loadLiveScoreSession()?.matchId === matchId) saveLiveScoreSession({ matchId, recordId });
  }

  private closeSession(matchId: string): void {
    if (loadLiveScoreSession()?.matchId === matchId) saveLiveScoreSession(null);
  }

  private setStatus(status: LiveSendStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Ein Listener darf den Sender nicht stören.
      }
    }
  }
}
