/** Presentation metadata travels with the saved game, without changing its rules. */
export interface SessionStats {
  playedMs: number;
  recordAtStart: number;
  completeDuration: boolean;
}

export function readSessionStats(value: unknown): SessionStats | undefined {
  if (!value || typeof value !== 'object') return;
  const s = value as SessionStats;
  if (!Number.isFinite(s.playedMs) || s.playedMs < 0 || s.playedMs > Number.MAX_SAFE_INTEGER
    || !Number.isSafeInteger(s.recordAtStart) || s.recordAtStart < 0 || typeof s.completeDuration !== 'boolean') return;
  return { playedMs: s.playedMs, recordAtStart: s.recordAtStart, completeDuration: s.completeDuration };
}

export function formatDuration(playedMs: number): string {
  const seconds = Math.floor(playedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const tail = `${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${tail}` : tail;
}
