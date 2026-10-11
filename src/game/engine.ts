import { cells, kicks, shuffledBag, type Cell, type Piece, type PieceType } from './pieces';

export const COLS = 10;
export const ROWS = 22;
export const HIDDEN_ROWS = 2;
export const LOCK_DELAY = 500;
export const MAX_LOCK_RESETS = 15;
export type Status = 'paused' | 'playing' | 'over';
export type Action = 'left' | 'right' | 'down' | 'cw' | 'ccw' | 'drop' | 'hold';
export interface GameState {
  board: Cell[][];
  active: Piece;
  next: PieceType;
  hold: PieceType | null;
  holdUsed: boolean;
  bag: PieceType[];
  score: number;
  lines: number;
  level: number;
  status: Status;
  gravityMs: number;
  lockMs: number;
  lockResets: number;
}
export const emptyBoard = (): Cell[][] => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
export const spawn = (type: PieceType): Piece => ({ type, x: 3, y: type === 'I' ? 1 : HIDDEN_ROWS, rotation: 0 });
export function collides(board: Cell[][], piece: Piece): boolean {
  return cells(piece).some(([x, y]) => x < 0 || x >= COLS || y < 0 || y >= ROWS || board[y][x] !== null);
}
export function clearLines(board: Cell[][]): { board: Cell[][]; cleared: number } {
  const remaining = board.filter(row => row.some(cell => cell === null));
  const cleared = ROWS - remaining.length;
  return { board: [...Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(null)), ...remaining], cleared };
}
export const gravityInterval = (level: number): number => Math.max(65, 900 * Math.pow(0.8, level - 1));

export class Game {
  state: GameState;
  locks = 0;
  lastClear = 0;
  // Time actually simulated in this instance; excludes pauses and unused time after game over.
  elapsedMs = 0;
  constructor(private readonly random = Math.random, saved?: GameState) {
    if (saved) {
      this.state = structuredClone(saved);
      this.state.status = saved.status === 'over' ? 'over' : 'paused';
    } else {
      const bag = shuffledBag(random);
      this.state = {
        board: emptyBoard(), active: spawn(bag.shift()!), next: bag.shift()!, bag,
        hold: null, holdUsed: false, score: 0, lines: 0, level: 1, status: 'paused',
        gravityMs: 0, lockMs: 0, lockResets: 0,
      };
    }
  }
  snapshot(): GameState { return structuredClone(this.state); }
  resume(): void { if (this.state.status === 'paused') this.state.status = 'playing'; }
  pause(): void { if (this.state.status === 'playing') this.state.status = 'paused'; }
  grounded(): boolean { return collides(this.state.board, { ...this.state.active, y: this.state.active.y + 1 }); }
  ghost(): Piece {
    const ghost = { ...this.state.active };
    while (!collides(this.state.board, { ...ghost, y: ghost.y + 1 })) ghost.y++;
    return ghost;
  }
  private resetLock(wasGrounded: boolean): void {
    if (wasGrounded && this.state.lockResets < MAX_LOCK_RESETS) {
      this.state.lockMs = 0;
      this.state.lockResets++;
    }
  }
  private move(dx: number, dy: number): boolean {
    const next = { ...this.state.active, x: this.state.active.x + dx, y: this.state.active.y + dy };
    if (collides(this.state.board, next)) return false;
    const wasGrounded = this.grounded();
    this.state.active = next;
    if (dx) this.resetLock(wasGrounded);
    return true;
  }
  private rotate(direction: 1 | -1): boolean {
    const current = this.state.active;
    if (current.type === 'O') return false;
    const rotation = (current.rotation + direction + 4) % 4;
    for (const [dx, dy] of kicks(current.type, current.rotation, rotation)) {
      const next = { ...current, rotation, x: current.x + dx, y: current.y + dy };
      if (!collides(this.state.board, next)) {
        const wasGrounded = this.grounded();
        this.state.active = next;
        this.resetLock(wasGrounded);
        return true;
      }
    }
    return false;
  }
  private drawNext(): PieceType {
    if (!this.state.bag.length) this.state.bag = shuffledBag(this.random);
    return this.state.bag.shift()!;
  }
  private enter(type: PieceType): void {
    this.state.active = spawn(type);
    this.state.gravityMs = 0;
    this.state.lockMs = 0;
    this.state.lockResets = 0;
    if (collides(this.state.board, this.state.active)) this.state.status = 'over';
  }
  private lock(): void {
    const s = this.state;
    const occupied = cells(s.active);
    for (const [x, y] of occupied) s.board[y][x] = s.active.type;
    this.locks++;
    // A piece locked entirely above the visible playfield ends the game.
    if (occupied.every(([, y]) => y < HIDDEN_ROWS)) {
      s.status = 'over';
      this.lastClear = 0;
      return;
    }
    const result = clearLines(s.board);
    this.lastClear = result.cleared;
    s.board = result.board;
    s.score += [0, 100, 300, 500, 800][result.cleared] * s.level;
    s.lines += result.cleared;
    s.level = Math.floor(s.lines / 10) + 1;
    s.holdUsed = false;
    const next = s.next;
    s.next = this.drawNext();
    this.enter(next);
  }
  act(action: Action): boolean {
    if (this.state.status !== 'playing') return false;
    if (action === 'left' || action === 'right') return this.move(action === 'left' ? -1 : 1, 0);
    if (action === 'cw' || action === 'ccw') return this.rotate(action === 'cw' ? 1 : -1);
    if (action === 'down') {
      if (!this.move(0, 1)) return false;
      this.state.score++;
      return true;
    }
    if (action === 'drop') {
      const ghost = this.ghost();
      this.state.score += (ghost.y - this.state.active.y) * 2;
      this.state.active = ghost;
      this.lock();
      return true;
    }
    if (this.state.holdUsed) return false;
    const previous = this.state.hold;
    this.state.hold = this.state.active.type;
    const replacement = previous ?? this.state.next;
    if (previous === null) this.state.next = this.drawNext();
    this.enter(replacement);
    this.state.holdUsed = true;
    return true;
  }
  advance(elapsedMs: number): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
    // Integrate to the next gravity/lock deadline, independently of frame rate.
    let remaining = Math.min(elapsedMs, 5000);
    while (remaining > 0 && this.state.status === 'playing') {
      const s = this.state;
      const grounded = this.grounded();
      const interval = gravityInterval(s.level);
      const step = Math.min(remaining, interval - s.gravityMs, grounded ? LOCK_DELAY - s.lockMs : Infinity);
      s.gravityMs += step;
      this.elapsedMs += step;
      if (grounded) s.lockMs += step;
      remaining -= step;
      if (grounded && s.lockMs >= LOCK_DELAY) { this.lock(); continue; }
      if (s.gravityMs >= interval) { s.gravityMs = 0; this.move(0, 1); }
    }
  }
}
