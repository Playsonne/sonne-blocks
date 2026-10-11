import { COLS, ROWS, LOCK_DELAY, MAX_LOCK_RESETS, collides, gravityInterval, type GameState } from './game/engine';
import { TYPES, type PieceType } from './game/pieces';
import { readSessionStats, type SessionStats } from './session';

export const SAVE_KEY = 'sonne-blocks:save:v1';
export const RECORD_KEY = 'sonne-blocks:record:v1';
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
const pieceType = (v: unknown): v is PieceType => TYPES.includes(v as PieceType);
const timer = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < max;
export function validState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as GameState;
  if (!Array.isArray(s.board) || s.board.length !== ROWS || !s.board.every(row => Array.isArray(row) && row.length === COLS && row.every(c => c === null || pieceType(c)))) return false;
  if (s.board.some(row => row.every(cell => cell !== null))) return false;
  if (!s.active || !pieceType(s.active.type) || !integer(s.active.rotation, 0, 3) || !integer(s.active.x, -3, 9) || !integer(s.active.y, 0, 21)) return false;
  if (!pieceType(s.next) || !(s.hold === null || pieceType(s.hold)) || typeof s.holdUsed !== 'boolean') return false;
  if (!Array.isArray(s.bag) || s.bag.length > 7 || !s.bag.every(pieceType) || new Set(s.bag).size !== s.bag.length) return false;
  if (!integer(s.score) || !integer(s.lines) || s.level !== Math.floor(s.lines / 10) + 1) return false;
  if (!['playing', 'paused'].includes(s.status)) return false;
  if (!timer(s.gravityMs, gravityInterval(s.level)) || !timer(s.lockMs, LOCK_DELAY) || !integer(s.lockResets, 0, MAX_LOCK_RESETS)) return false;
  if (s.holdUsed && s.hold === null) return false;
  return !collides(s.board, s.active);
}
export class Persistence {
  available = true;
  corrupted = false;
  session?: SessionStats;
  private storage?: Storage;
  constructor(storage?: Storage) {
    try { this.storage = storage ?? window.localStorage; } catch { this.available = false; }
  }
  private read(key: string): string | null {
    try { return this.storage?.getItem(key) ?? null; } catch { this.available = false; return null; }
  }
  private write(key: string, value: string | null): void {
    try {
      if (!this.storage) { this.available = false; return; }
      if (value === null) this.storage.removeItem(key); else this.storage.setItem(key, value);
    } catch { this.available = false; }
  }
  load(): GameState | undefined {
    this.session = undefined;
    const raw = this.read(SAVE_KEY);
    if (!raw) return;
    try {
      if (raw.length > 16000) throw new Error('Tamaño');
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || !validState(parsed?.state)) throw new Error('Formato');
      // Old saves remain valid. Invalid optional metadata never discards a playable game.
      this.session = readSessionStats(parsed.session);
      return { ...parsed.state, status: 'paused' };
    } catch { this.corrupted = true; this.clear(); return; }
  }
  save(state: GameState, session?: SessionStats): void {
    if (state.status === 'over') { this.clear(); return; }
    this.write(SAVE_KEY, JSON.stringify({ version: 1, state, session }));
  }
  clear(): void { this.write(SAVE_KEY, null); }
  record(): number {
    try {
      const value = JSON.parse(this.read(RECORD_KEY) ?? 'null');
      return value?.version === 1 && integer(value.score) ? value.score : 0;
    } catch { return 0; }
  }
  setRecord(score: number): void { this.write(RECORD_KEY, JSON.stringify({ version: 1, score })); }
}
