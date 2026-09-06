import { apiPost } from "../../../lib/api";

export type WatchSessionValidityStatus =
  | "PENDING"
  | "VALID"
  | "INVALID"
  | "UNDETERMINED";

export interface WatchSession {
  id: number;
  libraryVideoId: number;
  startedAt: string;
  endedAt: string | null;
  lastHeartbeatAt: string;
  watchTimeSeconds: number;
  validityStatus: WatchSessionValidityStatus;
}

export interface PlayedSecondsDeltaInput {
  playedSecondsDelta: number;
}

export function startWatchSession(
  libraryVideoId: number,
) {
  return apiPost<WatchSession>(
    `/api/library/videos/${libraryVideoId}/watch-sessions`,
  );
}

export function sendWatchHeartbeat(
  watchSessionId: number,
  playedSecondsDelta: number,
) {
  return apiPost<
    WatchSession,
    PlayedSecondsDeltaInput
  >(
    `/api/watch-sessions/${watchSessionId}/heartbeat`,
    {
      playedSecondsDelta,
    },
  );
}

export function closeWatchSession(
  watchSessionId: number,
  playedSecondsDelta: number,
) {
  return apiPost<
    WatchSession,
    PlayedSecondsDeltaInput
  >(
    `/api/watch-sessions/${watchSessionId}/close`,
    {
      playedSecondsDelta,
    },
  );
}